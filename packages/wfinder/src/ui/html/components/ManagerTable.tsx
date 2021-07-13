import { defaultPropsFc } from "./../../tools/fc";
import React, { Component, useEffect } from "react";
import { useLaterEffect, useStableState } from "../../hooks/hooks";
import {
  message,
  Spin,
  Table,
  Tooltip,
  Input,
  Popconfirm,
  Button,
  Switch,
} from "antd";
import { ColumnsType, ColumnType } from "antd/lib/table";
import dayjs from "dayjs";
import { GetRowKey } from "antd/lib/table/interface";
import { useCallback } from "react";
import { PlusOutlined } from "@ant-design/icons";
import { Empty } from "./Empty";

const TEXT_OPERATION = "operation";
type TypeTableEditRenderProps<T> = {
  value: T | undefined;
  onChange: (val: T) => void;
};
export type TypeTableEditRender<T> = (
  props: TypeTableEditRenderProps<T>
) => JSX.Element;
export type TypeTableEditProps<T> = {
  [index in keyof T]?: TypeTableEditRender<T[index]>;
};

export const SimpleTextEdit: TypeTableEditRender<string> = (props) => {
  const onChange: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    (ev) => {
      props.onChange(ev.target.value);
    },
    [props.onChange]
  );
  return <Input value={props.value} onChange={onChange} />;
};

export const SimpleBooleanEdit: TypeTableEditRender<boolean | undefined> = (
  props
) => {
  return <Switch checked={props.value} onChange={props.onChange} />;
};

export type TypeManagerTableAddonButtonProps = {
  isEdit: boolean;
  isNew: boolean;
  isReadonly: boolean;
};

export const genManagerTable = <T extends Record<string, unknown>>(
  showProperties: (keyof T)[],
  editableProperties: TypeTableEditProps<T>,
  newRecordProperties: TypeTableEditProps<T>,
  rowKey: string | GetRowKey<T>,
  getEmptyRecord: () => T,
  AddonButton?: React.FC<TypeManagerTableAddonButtonProps>
) => {
  return defaultPropsFc(
    {
      className: "",
      tableTitle: "" as string | JSX.Element,
      titleClassName: "",
      records: [] as T[],
      loading: false,
      showProperties,
      editableProperties,
      newRecordProperties,
      rowKey,
      readOnly: false,
      onNewRecord: null as null | ((data: T) => Promise<boolean>),
      onRemove: null as null | ((data: T) => Promise<void>),
      onSave: null as null | ((data: T) => Promise<boolean>),
    },
    (props) => {
      const [state, setState, update] = useStableState(() => {
        const genColumns = () => {
          const isEdit = (record: T) =>
            record === state.newRecord || record === state.editRecord;
          const plainRender: ColumnType<T>["render"] = (v) => {
            const content = (
              <div className="truncate">
                {v instanceof Date
                  ? dayjs(v).format("YYYY-MM-DD hh:mm:ss")
                  : typeof v === "number"
                  ? String(v)
                  : typeof v === "string"
                  ? v
                  : !v
                  ? ""
                  : String(v)}
              </div>
            );
            return <Tooltip title={content}>{content}</Tooltip>;
          };
          const columns: ColumnsType<T> = props.showProperties.map((p) => {
            const prop = String(p);
            const editRender = editableProperties[p];
            const newRender = newRecordProperties[p];
            const onChange = (val: T[typeof p]) => {
              const record = state.editRecord || state.newRecord;
              if (record) {
                record[p] = val;
                update();
              }
            };
            return {
              title: prop,
              key: prop,
              dataIndex: prop,
              render:
                !editRender && !newRender
                  ? plainRender
                  : (v: T[typeof p], record, index) => {
                      const Render =
                        record === state.editRecord
                          ? editRender
                          : record === state.newRecord
                          ? newRender
                          : null;
                      if (Render) {
                        return (
                          <div>
                            {/* @ts-ignore */}
                            <Render value={v} onChange={onChange} />
                          </div>
                        );
                      }
                      return plainRender(v, record, index);
                    },
            } as ColumnType<T>;
          });
          const hasEditProps = !!Object.keys(editableProperties);
          return columns.concat(
            props.readOnly
              ? []
              : [
                  {
                    title: TEXT_OPERATION,
                    key: TEXT_OPERATION,
                    dataIndex: TEXT_OPERATION,
                    render: (v, record) => {
                      const { onRemove } = props;
                      return (
                        <div>
                          {isEdit(record) ? (
                            <>
                              {record === state.newRecord ? (
                                <a
                                  onClick={async () => {
                                    const { newRecord } = state;
                                    const { onNewRecord } = props;
                                    if (!newRecord || !onNewRecord) return;
                                    const data = { ...newRecord };
                                    if (await onNewRecord(data))
                                      setState({ newRecord: null });
                                  }}
                                  className=" p-1"
                                >
                                  Add
                                </a>
                              ) : (
                                <Popconfirm
                                  title="Save change?"
                                  onConfirm={async () => {
                                    const { onSave } = props;
                                    const { editRecord } = state;
                                    if (!onSave || !editRecord) return;
                                    const data = { ...editRecord };
                                    if (await onSave(data))
                                      setState({ editRecord: null });
                                  }}
                                >
                                  <a className="text-red-500 p-1">Save</a>
                                </Popconfirm>
                              )}
                              <a
                                className="p-0.5"
                                onClick={() =>
                                  setState({
                                    newRecord: null,
                                    editRecord: null,
                                  })
                                }
                              >
                                Cancel
                              </a>
                            </>
                          ) : state.editRecord || state.newRecord ? null : (
                            <>
                              {hasEditProps && props.onSave && (
                                <a
                                  className="p-0.5"
                                  onClick={() =>
                                    setState({ editRecord: record })
                                  }
                                >
                                  Edit
                                </a>
                              )}
                              {!!onRemove && (
                                <Popconfirm
                                  title="Remove this record?"
                                  onConfirm={() => onRemove(record)}
                                >
                                  <a className="text-red-500 px-0.5">Remove</a>
                                </Popconfirm>
                              )}
                            </>
                          )}
                        </div>
                      );
                    },
                  },
                ]
          );
        };
        return {
          newRecord: null as null | T,
          editRecord: null as null | T,
          dataSource: props.records,
          columns: genColumns(),
          genColumns,
          addRecord: async () => setState({ newRecord: getEmptyRecord() }),
        };
      });

      useLaterEffect(() => {
        setState({ columns: state.genColumns() });
      }, [
        props.editableProperties,
        props.newRecordProperties,
        props.showProperties,
        props.rowKey,
        props.onNewRecord,
        props.onRemove,
      ]);

      useLaterEffect(() => {
        if (state.newRecord || state.editRecord)
          setState({ newRecord: null, editRecord: null });
      }, [props.records]);

      useLaterEffect(() => {
        setState({
          dataSource: [
            ...(state.newRecord ? [state.newRecord] : []),
            ...props.records,
          ],
        });
      }, [props.records, state.newRecord]);

      return (
        <div className={"flex flex-col " + props.className}>
          <div className={props.titleClassName + " flex flex-row items-center"}>
            {props.tableTitle}
            <div className="flex-grow" />
            {!props.readOnly && !state.editRecord && !state.newRecord && (
              <Button type="primary" size="small" onClick={state.addRecord}>
                <div className="flex items-center">
                  <PlusOutlined />
                  Add
                </div>
              </Button>
            )}
            {AddonButton && (
              <AddonButton
                isEdit={!!state.editRecord}
                isNew={!!state.newRecord}
                isReadonly={props.readOnly}
              />
            )}
          </div>
          <div className="flex overflow-auto">
            {state.dataSource.length ? (
              <Table
                className="w-full"
                pagination={false}
                dataSource={state.dataSource}
                columns={state.columns}
                loading={props.loading}
                rowKey={props.rowKey}
              />
            ) : (
              <Empty onAdd={state.addRecord} />
            )}
          </div>
        </div>
      );
    },
    true
  );
};
