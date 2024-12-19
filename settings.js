/*
Base By Axel
Creator is Selxyzz
Group Main Bot: https://chat.whatsapp.com/He1CTwgCL6B3lpQ8dvtPvY
Join Untuk Menggunakan Bot
*/

const fs = require('node:fs');

const config = {
    owner: ["6282353035070"],
    name: "Nasirxml",
    sessions: "Devo-Sessions",
    sticker: {
      packname: "Bot WhatsApp",
      author: ""
    },
    apikey: "5SdBTI3hMfDFIOZxJ7",
    apikeyPrem: "pasonki23",
   messages: {
      wait: "*( Loading )* Tunggu Sebentar...",
      owner: "*( Denied )* Kamu bukan owner ku !",
      premium: "*( Denied )* Fitur ini khusus user premium",
      group: "*( Denied )* Fitur ini khusus group",
      botAdmin: "*( Denied )* Fitur ini hanya bisa di akses hanya ketika bot menjadi admin.*"
   },
   database: "neko-db",
   tz: "Asia/Jakarta"
}

module.exports = config

let file = require.resolve(__filename);
fs.watchFile(file, () => {
   fs.unwatchFile(file);
  delete require.cache[file];
});
