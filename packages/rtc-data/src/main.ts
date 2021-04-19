import { Client } from "./client/client";
import { serve } from "./server/server";

serve();

setTimeout(() => {
  doClient("1");
}, 300);

const doClient = (tag: string) => {
  const client = new Client("http://127.0.0.1:9000", tag);
  client.addEventListener("connect", (id) => {
    client.sendTo(id, "msg from client: " + client.id);
  });
  client.addEventListener("data", (id, data) => {
    console.log(data);
    client.sendTo(id, "server echo");
  });

  const client1 = new Client("http://127.0.0.1:9000");
  client1.addEventListener("tagList", (tagList) => {
    tagList.forEach((t) => client1.sendTo(t.id, Buffer.from("aabbcc")));
  });
};
