const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const imagePath = path.join(__dirname, 'imagen', 'img1.png');
const groupsFilePath = path.join(__dirname, 'grupos_permitidos.json');
const bannerFilePath = path.join(__dirname, 'banner.txt');
const privateMessageFilePath = path.join(__dirname, 'privado.txt');
const configFilePath = path.join(__dirname, 'config.json');

async function handleCommand(client, body, sender, message, state, actions) {
  const { banner, gruposPermitidos, botConfig, privateMessage } = state;
  const {
    saveAllowedGroups,
    saveBanner,
    saveConfig,
    savePrivateMessage,
    reiniciarEnvioProgramado,
    obtenerGrupos,
    enviarMensajesGrupos
  } = actions;

  if (body.startsWith('.setbanner')) {
    const nuevoBanner = body.slice(10).trim();
    if (!nuevoBanner) {
      return await client.sendMessage(sender, {
        text: '❌ Escribe el nuevo texto del banner. Ej: *.setbanner Bienvenidos al grupo*',
      });
    }
    saveBanner(nuevoBanner);
    await client.sendMessage(sender, {
      text: `✅ Banner actualizado:\n\n${nuevoBanner}`,
    });
    // Actualizar el estado en memoria
    state.banner = nuevoBanner;
  } else if (body === '.banner') {
    let media = null;
    try {
      media = fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : null;
    } catch {
      media = null;
    }

    if (media) {
      await client.sendMessage(sender, {
        image: media,
        caption: `📢 Banner actual:\n\n${banner}`,
      });
    } else {
      await client.sendMessage(sender, {
        text: `📢 Banner actual (sin imagen):\n\n${banner}`,
      });
    }
  } else if (body === '.listgrupos') {
    const grupos = await obtenerGrupos();
    const infoGrupos = await client.groupFetchAllParticipating();
    const nombres = grupos.map(gid => {
      const grupo = infoGrupos[gid];
      const esPermitido = gruposPermitidos.includes(gid) ? '✅' : '❌';
      return `${esPermitido} ${grupo.subject} → ${gid}`;
    }).join('\n');

    await client.sendMessage(sender, {
      text: `📋 Lista de grupos donde estoy:\n\n${nombres}`
    });
  } else if (body.startsWith('.addgrupo')) {
    const nombre = body.slice(9).trim().toLowerCase();
    const grupos = await client.groupFetchAllParticipating();
    const grupo = Object.values(grupos).find(g => g.subject.toLowerCase().includes(nombre));
    if (!grupo) {
      return await client.sendMessage(sender, {
        text: '❌ Grupo no encontrado. Usa *.listgrupos* para ver nombres exactos.',
      });
    }
    if (!gruposPermitidos.includes(grupo.id)) {
      gruposPermitidos.push(grupo.id);
      saveAllowedGroups(gruposPermitidos);
    }
    await client.sendMessage(sender, {
      text: `✅ Grupo "${grupo.subject}" agregado a la lista de envío.`,
    });
  } else if (body.startsWith('.delgrupo')) {
    const nombre = body.slice(9).trim().toLowerCase();
    const grupos = await client.groupFetchAllParticipating();
    const grupo = Object.values(grupos).find(g => g.subject.toLowerCase().includes(nombre));
    if (!grupo) {
      return await client.sendMessage(sender, {
        text: '❌ Grupo no encontrado. Usa *.listgrupos* para ver nombres exactos.',
      });
    }
    const index = gruposPermitidos.indexOf(grupo.id);
    if (index > -1) {
      gruposPermitidos.splice(index, 1);
      saveAllowedGroups(gruposPermitidos);
    }
    await client.sendMessage(sender, {
      text: `✅ Grupo "${grupo.subject}" eliminado de la lista de envío.`,
    });
  } else if (body === '.setimg') {
    const context = message.message?.extendedTextMessage?.contextInfo;
    const quoted = context?.quotedMessage;
    const quotedKey = {
      remoteJid: sender,
      fromMe: false,
      id: context?.stanzaId,
      participant: context?.participant
    };

    if (!quoted || !quoted.imageMessage) {
      return await client.sendMessage(sender, {
        text: '❌ Debes responder a una imagen con el comando *.setimg*.',
      });
    }
    try {
      const imgBuffer = await downloadMediaMessage({ message: quoted, key: quotedKey }, 'buffer', {}, { logger: console, reuploadRequest: client.updateMediaMessage });
      fs.writeFileSync(imagePath, imgBuffer);
      await client.sendMessage(sender, {
        text: '✅ Imagen del banner actualizada correctamente.',
      });
    } catch (err) {
      console.error(err);
      await client.sendMessage(sender, {
        text: '❌ No se pudo guardar la imagen. Asegúrate de responder a una imagen válida y reciente.',
      });
    }
  } else if (body.startsWith('.setprivado')) {
    const nuevoPrivado = body.slice(12).trim();
    if (!nuevoPrivado) {
      return await client.sendMessage(sender, {
        text: '❌ Escribe el nuevo mensaje. Ej: *.setprivado Hola, ¿cómo puedo ayudarte?*',
      });
    }
    savePrivateMessage(nuevoPrivado);
    await client.sendMessage(sender, {
      text: `✅ Mensaje privado actualizado:\n\n${nuevoPrivado}`,
    });
    state.privateMessage = nuevoPrivado;
  } else if (body.startsWith('.setinterval')) {
    const horas = parseInt(body.slice(12).trim());
    if (isNaN(horas) || horas < 1) {
      return await client.sendMessage(sender, {
        text: '❌ Debes indicar un número válido de horas. Ej: *.setinterval 2*',
      });
    }
    saveConfig({ intervaloEnvio: horas });
    await reiniciarEnvioProgramado();
    await client.sendMessage(sender, {
      text: `✅ Intervalo actualizado. Ahora se enviará cada ${horas} hora(s).`,
    });
    state.botConfig.intervaloEnvio = horas;
  } else if (body === '.enviar') {
    await client.sendMessage(sender, { text: '📢 Iniciando envío manual de banner...' });
    await enviarMensajesGrupos();
    await client.sendMessage(sender, { text: '✅ Envío manual completado.' });
  } else if (body === '.estado') {
    const estadoMensaje = `
📋 *Estado del Bot*
-----------------------
*Intervalo de envío:* Cada ${botConfig.intervaloEnvio} hora(s)
*Grupos permitidos:* ${gruposPermitidos.length} grupos
*Mensaje privado:* "${privateMessage.substring(0, 30)}..."
-----------------------
_Usa .listgrupos para ver los grupos_
    `;
    await client.sendMessage(sender, { text: estadoMensaje });
  }
}

module.exports = { handleCommand };
