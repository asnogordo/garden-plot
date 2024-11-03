const { MessageType } = require('discord.js');
const { 
  GM_CHANNEL_ID, SUPPORT_CHANNEL_ID, SCAM_CHANNEL_ID, BASE_ROLE_ID 
} = require('./config');
const { pickFromList } = require('./utils');

const wenMoon = /.*(wh?en|where).*mo+n.*/i;

// GIF lists
const wenMoonGifs = [
  'https://c.tenor.com/YZWhYF-xV4kAAAAd/when-moon-admin.gif',
  'https://c.tenor.com/x-kqDAmw2NQAAAAC/parrot-party.gif',
  'https://c.tenor.com/R6Zf7aUegagAAAAd/lambo.gif',
  'https://media1.tenor.com/m/9idtwWwfCdAAAAAC/wen-when.gif',
  'https://media1.tenor.com/m/LZZfKVHwpoIAAAAC/waiting-penguin.gif',
  'https://media1.tenor.com/m/1vXRFJxqIVgAAAAC/waiting-waiting-patiently.gif',
  'https://media1.tenor.com/m/XIr-1aBPoCEAAAAC/walk-hard-the-dewey-cox-story.gif'
];

const pickMoon = pickFromList(wenMoonGifs);

// Map to store recent messages
const recentMessages = new Map();

async function handleMessage(message) {
  try {
    const { author, content, member, channel } = message;

    if (message.author.bot) {
      console.log('Do not reply to bots', message.author.tag);
      return;
    }
    if (message.type !== MessageType.Default && message.type !== MessageType.Reply) {
      console.log('Can only interact with default messages and replies', message.type);
      return;
    }
    console.log(message.type);
    if (message.type !== MessageType.Default) {
      console.log('Can only interact with default messages', message.type);
      return;
    }
    if (wenMoon.test(message.content)) {
      await message.reply(pickMoon());
    }
  } catch (e) {
    console.error('Something failed handling a message', e);
  }
}


module.exports = {
  handleMessage
};