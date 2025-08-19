const {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  downloadMediaMessage
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Importar los módulos separados
const { handleCommand } = require('./commands');
const {
  loadConfig,
  saveConfig,
  loadAllowedGroups,
  saveAllowedGroups,
  loadBanner,
  saveBanner,
  loadPrivateMessage,
  savePrivateMessage
} = require('./utils');

const imagePath = path.join(__dirname, 'imagen', 'img1.png');
const configPath = path.join(__dirname, 'config.json');

let botConfig = loadConfig(configPath);
let banner = loadBanner();
let gruposPermitidos = loadAllowedGroups();
let privateMessage = loadPrivateMessage();

let envioProgramadoIniciado = false;
let intervalId = null;

const owners = ['5217152613752'];
const actividadUsuarios = {};

async function startBot() {
  try {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('./auth');

    const client = makeWASocket({ auth: state, version });

    client.ev.on('creds.update', saveCreds);

    if (!fs.existsSync('imagen')) {
      fs.mkdirSync('imagen');
    }

    client.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log("Escanea este código QR para conectar:");
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode || 0;
        if (reason === DisconnectReason.loggedOut) {
          console.log('Usuario desconectado. Cerrando...');
          process.exit(0);
        }
        console.log('Conexión cerrada. Intentando reconectar...');
        setTimeout(startBot, 5000);
      } else if (connection === 'open') {
        console.log('El bot está listo');
        iniciarEnvioProgramado();
      }
    });

    async function obtenerGrupos() {
      try {
        const grupos = await client.groupFetchAllParticipating();
        return Object.keys(grupos);
      } catch (error) {
        console.error('Error al obtener los grupos:', error);
        return [];
      }
    }

    async function enviarMensajesGrupos() {
      try {
        const groupChats = await obtenerGrupos();
        const gruposFiltrados = groupChats.filter(gid => gruposPermitidos.includes(gid));
        let media = null;

        try {
          media = await fs.promises.readFile(imagePath);
        } catch {
          console.log("No se encontró la imagen, solo se enviará texto.");
        }

        for (const chatId of gruposFiltrados) {
          try {
            // Se puede agregar lógica para evitar el spam, pero la versión original ya lo tenía
            await client.sendMessage(chatId, { image: media, caption: banner });
          } catch (error) {
            console.error(`Error al enviar mensaje al grupo ${chatId}:`, error);
          }
        }
        console.log("Se enviaron los mensajes a todos los grupos.");
      } catch (error) {
        console.error('Error al enviar mensajes a los grupos:', error);
      }
    }

    function iniciarEnvioProgramado() {
      if (envioProgramadoIniciado) return;
      envioProgramadoIniciado = true;
      intervalId = setInterval(enviarMensajesGrupos, botConfig.intervaloEnvio * 60 * 60 * 1000);
    }
    
    async function reiniciarEnvioProgramado() {
      if (intervalId) {
        clearInterval(intervalId);
      }
      envioProgramadoIniciado = false;
      iniciarEnvioProgramado();
    }

    client.ev.on('messages.upsert', async ({ messages }) => {
      const message = messages[0];
      if (!message?.message || message.key.fromMe) return;

      const sender = message.key.remoteJid;
      const isGroup = sender.endsWith('@g.us');
      const senderNumber = message.key.participant
        ? message.key.participant.split('@')[0]
        : sender.split('@')[0];

      // Anti-spam en privado
      if (!isGroup && !owners.includes(senderNumber)) {
        const ahora = Date.now();
        const ventana = 30 * 1000;
        const limite = 5;

        if (!actividadUsuarios[senderNumber]) {
          actividadUsuarios[senderNumber] = [];
        }

        actividadUsuarios[senderNumber] = actividadUsuarios[senderNumber].filter(ts => ahora - ts < ventana);
        actividadUsuarios[senderNumber].push(ahora);

        if (actividadUsuarios[senderNumber].length > limite) {
          await client.sendMessage(sender, {
            text: '🚫 Has sido bloqueado por enviar demasiados mensajes seguidos.',
          });

          try {
            await client.updateBlockStatus(sender, 'block');
            console.log(`🔒 Usuario bloqueado por spam: ${senderNumber}`);
          } catch (err) {
            console.error(`❌ Error al bloquear ${senderNumber}:`, err);
          }
          return;
        }

        await client.sendMessage(sender, { text: privateMessage });
        return;
      }

      if (!owners.includes(senderNumber)) return;

      const body = message.message.conversation || message.message.extendedTextMessage?.text || '';

      // Delegar el manejo de comandos al archivo commands.js
      await handleCommand(
        client,
        body,
        sender,
        message,
        {
          banner,
          gruposPermitidos,
          botConfig,
          privateMessage
        },
        {
          saveAllowedGroups,
          saveBanner,
          saveConfig,
          savePrivateMessage,
          reiniciarEnvioProgramado,
          obtenerGrupos,
          enviarMensajesGrupos
        }
      );
    });
  } catch (error) {
    console.error("Error al iniciar el bot:", error);
    setTimeout(startBot, 10000);
  }
}

startBot();
