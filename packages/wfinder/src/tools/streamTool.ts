export const packetTool = {
  wrapData: (data: string | Buffer) => {
    const buffer = Buffer.from(data);
    const head = Buffer.alloc(4);
    head.writeUInt32BE(buffer.length);
    return Buffer.concat([head, buffer]);
  },
  parseData: (data: Buffer) => {
    const res: Buffer[] = [];
    let pos = 0;
    while (pos < data.length) {
      const length = data.readUInt32BE(pos);
      pos += 4;
      res.push(data.slice(pos, pos + length));
      pos += length;
    }
    if (pos !== data.length)
      throw new Error("Split packets error, wrong length info.");
    return res;
  },
};
