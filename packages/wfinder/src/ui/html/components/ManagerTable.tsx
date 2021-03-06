import { PlusOutlined } from "@ant-design/icons";
import { Button, Input, Popconfirm, Switch, Table, Tooltip } from "antd";
import { ColumnsType, ColumnType } from "antd/lib/table";
import { GetRowKey } from "antd/lib/table/interface";
import React, { useCallback } from "react";
import { executeUiCmd } from "../../../finder/events/eventTools";
import { isWebElectron } from "../../../finder/events/webEventTools";
import { TypeDbInfo } from "../../../finder/types";
import { formatDate } from "../../../tools/tool";
import { useLaterEffect, useStableState } from "../../hooks/hooks";
import { defaultPropsFc } from "./../../tools/fc";
import { Empty } from "./Empty";

const TEXT_OPERATION = "operation";
type TypeTableEditRenderProps<T> = {
  value: T | undefined;
  onChange: (val: T) => void;
  context?: TypeDbInfo;
};
export type TypeTableEditRender<T> = (
  props: TypeTableEditRenderProps<T>
) => JSX.Element;
export type TypeTableEditProps<T> = {
  [index in keyof T]?: TypeTableEditRender<T[index]>;
};
export type TypeTableRenderProps<T> = {
  [index in keyof T]?: ColumnType<T>["render"];
};

export const SimpleTextEdit: TypeTableEditRender<string> = (props) => {
  const onChange: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    (ev) => {
      props.onChange(ev.target.value);
    },
    [props.onChange]
  );
  return <Input className="min-w-5" value={props.value} onChange={onChange} />;
};

export const SimplePathEdit: TypeTableEditRender<string> = (props) => {
  const onChange: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    (ev) => {
      props.onChange(ev.target.value);
    },
    [props.onChange]
  );
  return (
    <div className="flex flex-row">
      <span className="min-w-20">
        <Input value={props.value} onChange={onChange} />
      </span>
      {isWebElectron && (
        <Button
          type="primary"
          onClick={async () => {
            const res = await executeUiCmd(
              "requestPickLocalPath",
              {
                cmd: "requestPickLocalPath",
                data: {
                  title: "Add one path to scan list.",
                  properties: ["createDirectory"],
                  toShotestAbsOrRel: true,
                },
                context: props.context,
              },
              Infinity
            );
            if (res.result.path) {
              props.onChange(res.result.path);
            }
          }}
        >
          Pick
        </Button>
      )}
    </div>
  );
};

export const SimpleBooleanEdit: TypeTableEditRender<boolean | undefined> = (
  props
) => {
  return <Switch checked={props.value} onChange={props.onChange} />;
};

export type TypeManagerTableAddonButtonProps<T> = {
  isTableEdit: boolean;
  isTableOnNew: boolean;
  isReadonly: boolean;
  records: T[];
  context: TypeDbInfo | undefined;
};

export type TypeManagerTableAddonOperationProps<T> = Omit<
  TypeManagerTableAddonButtonProps<T>,
  "records"
> & { record: T; index: number };

export const genManagerTable = <T extends Record<string, unknown>>(
  showProperties: (keyof T | { prop: keyof T; title: string })[],
  renderProterties: TypeTableRenderProps<T>,
  editableProperties: TypeTableEditProps<T>,
  newRecordProperties: TypeTableEditProps<T>,
  rowKey: string | GetRowKey<T>,
  getEmptyRecord: () => T,
  AddonButton?: React.FC<TypeManagerTableAddonButtonProps<T>>,
  AddonOperation?: React.FC<TypeManagerTableAddonOperationProps<T>>
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
      context: undefined as TypeDbInfo | undefined,
    },
    (props) => {
      const [state, setState, update] = useStableState(() => {
        const genColumns = () => {
          const isEdit = (record: T) =>
            state.editRecord &&
            state.getRecordKey(record) === state.getRecordKey(state.editRecord);
          const plainRender: ColumnType<T>["render"] = (v) => {
            const content =
              v instanceof Date
                ? formatDate(v)
                : typeof v === "number"
                ? String(v)
                : typeof v === "string"
                ? v
                : !v
                ? ""
                : String(v);
            return (
              <Tooltip title={content}>
                <div className="truncate max-w-md">{content}</div>
              </Tooltip>
            );
          };
          const columns: ColumnsType<T> = props.showProperties.map((p) => {
            const prop: keyof T = p instanceof Object ? p.prop : String(p);
            const title = p instanceof Object ? p.title : String(p);
            const showRender: ColumnType<T>["render"] =
              renderProterties[prop] || plainRender;
            const editRender: undefined | TypeTableEditRender<T[typeof prop]> =
              editableProperties[prop];
            const newRender: undefined | TypeTableEditRender<T[typeof prop]> =
              newRecordProperties[prop];
            const onChange = (val: T[typeof prop]) => {
              if (state.editRecord) {
                state.editRecord[prop] = val;
                update();
              }
            };
            return {
              title,
              key: prop,
              dataIndex: prop,
              render:
                !editRender && !newRender
                  ? showRender
                  : (v: T[typeof prop], record, index) => {
                      const Render =
                        isEdit(record) &&
                        (state.editType === "edit"
                          ? editRender
                          : state.editType === "new"
                          ? newRender
                          : null);
                      if (Render && state.editRecord) {
                        return (
                          <div>
                            <Render
                              value={state.editRecord[prop]}
                              onChange={onChange}
                              context={props.context}
                            />
                          </div>
                        );
                      }
                      return showRender(v, record, index);
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
                    render: (v, record, index) => {
                      const { onRemove } = props;
                      return (
                        <div className="flex flex-row items-center max-w-xs">
                          {isEdit(record) ? (
                            <>
                              {state.editType === "new" ? (
                                <a
                                  onClick={async () => {
                                    const { editRecord } = state;
                                    const { onNewRecord } = props;
                                    if (!editRecord || !onNewRecord) return;
                                    const data = { ...editRecord };
                                    if (await onNewRecord(data))
                                      setState({
                                        editRecord: null,
                                        editType: "",
                                      });
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
                                    if (await onSave(data)) state.clearEdit();
                                  }}
                                >
                                  <a className="text-red-500 p-1">Save</a>
                                </Popconfirm>
                              )}
                              <a className="p-1" onClick={state.clearEdit}>
                                Cancel
                              </a>
                            </>
                          ) : state.editRecord ? null : (
                            <>
                              {hasEditProps && props.onSave && (
                                <a
                                  className="p-1"
                                  onClick={() =>
                                    setState({
                                      editRecord: { ...record },
                                      editType: "edit",
                                    })
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
                                  <a className="text-red-500 px-1">Remove</a>
                                </Popconfirm>
                              )}
                            </>
                          )}
                          {AddonOperation && (
                            <AddonOperation
                              isTableEdit={
                                !!isEdit(record) && state.editType === "edit"
                              }
                              isTableOnNew={
                                !!isEdit(record) && state.editType === "new"
                              }
                              isReadonly={props.readOnly}
                              record={record}
                              index={index}
                              context={props.context}
                            />
                          )}
                        </div>
                      );
                    },
                  },
                ]
          );
        };
        return {
          editType: "" as "new" | "edit" | "",
          editRecord: null as null | T,
          dataSource: props.records,
          getRecordKey:
            typeof rowKey === "string" ? (v: T) => v[rowKey] : rowKey,
          columns: genColumns(),
          genColumns,
          addRecord: async () =>
            setState({ editRecord: getEmptyRecord(), editType: "new" }),
          clearEdit: () =>
            setState({
              editType: "",
              editRecord: null,
              dataSource: state.dataSource.filter(
                (v) => v !== state.editRecord
              ),
            }),
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
        props.context,
      ]);

      useLaterEffect(() => {
        setState({
          dataSource: [
            ...(state.editType === "new" && state.editRecord
              ? [state.editRecord]
              : []),
            ...props.records,
          ],
        });
      }, [props.records, state.editRecord]);

      return (
        <div className={"flex flex-col " + props.className}>
          <div className={props.titleClassName + " flex flex-row items-center"}>
            {props.tableTitle}
            <div className="flex-grow" />
            {!props.readOnly && props.onNewRecord && !state.editType && (
              <Button type="primary" size="small" onClick={state.addRecord}>
                <div className="flex items-center">
                  <PlusOutlined />
                  Add
                </div>
              </Button>
            )}
            {AddonButton && (
              <AddonButton
                isTableEdit={state.editType === "edit"}
                isTableOnNew={state.editType === "new"}
                isReadonly={props.readOnly}
                records={props.records}
                context={props.context}
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
              <Empty onAdd={props.onNewRecord && state.addRecord} />
            )}
          </div>
        </div>
      );
    },
    true
  );
};
