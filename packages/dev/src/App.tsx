import React from 'react';
import logo from './logo.svg';
import './App.css';
import { Client } from 'rtc-data';

function App() {
  return (
    <div className="App">
      <button onClick={() => {
        const client1 = new Client("http://127.0.0.1:9000");
        client1.addEventListener('tagList', (tagList) => {
          tagList.forEach(t => client1.sendTo(t.id, "aabbcc"))
        });
        client1.addEventListener('data', (id, data) => alert("msg from:" + id + '\n' + data))
        setTimeout(() => client1.close(), 10);
      }}>send msg</button>
    </div>
  );
}

export default App;
