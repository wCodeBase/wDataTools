import dayjs from "dayjs";

export const formatDate = (date: Date) => {
  if (!date) return "";
  return dayjs(date).format("YYYY-MM-DD hh:mm:ss");
};
