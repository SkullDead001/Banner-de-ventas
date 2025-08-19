const fs = require('fs');
const path = require('path');

const groupsFilePath = path.join(__dirname, 'grupos_permitidos.json');
const bannerFilePath = path.join(__dirname, 'banner.txt');
const privateMessageFilePath = path.join(__dirname, 'privado.txt');
const configFilePath = path.join(__dirname, 'config.json');

function loadConfig() {
  if (fs.existsSync(configFilePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
      if (data.intervaloEnvio && data.intervaloEnvio > 0) {
        return data;
      }
    } catch (err) {
      console.error('Error al leer config.json:', err);
    }
  }
  return { intervaloEnvio: 3 }; // Valor por defecto
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
    console.log('Configuración guardada.');
  } catch (err) {
    console.error('Error al guardar config.json:', err);
  }
}

function loadAllowedGroups() {
  if (fs.existsSync(groupsFilePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(groupsFilePath, 'utf-8'));
      return Array.isArray(data.permitidos) ? data.permitidos : [];
    } catch (err) {
      console.error('Error al leer grupos_permitidos.json:', err);
    }
  }
  return [];
}

function saveAllowedGroups(groups) {
  try {
    fs.writeFileSync(groupsFilePath, JSON.stringify({ permitidos: groups }, null, 2));
    console.log('Grupos permitidos guardados.');
  } catch (err) {
    console.error('Error al guardar grupos_permitidos.json:', err);
  }
}

function loadBanner() {
  if (fs.existsSync(bannerFilePath)) {
    return fs.readFileSync(bannerFilePath, 'utf-8');
  }
  return 'TEXTO DEL BANNER AQUÍ';
}

function saveBanner(text) {
  try {
    fs.writeFileSync(bannerFilePath, text, 'utf-8');
    console.log('Banner guardado.');
  } catch (err) {
    console.error('Error al guardar banner.txt:', err);
  }
}

function loadPrivateMessage() {
  if (fs.existsSync(privateMessageFilePath)) {
    return fs.readFileSync(privateMessageFilePath, 'utf-8');
  }
  return 'AQUI VA EL MENSAJE EN CASO DE QUE LE ESCRIBAN AL PRIVADO';
}

function savePrivateMessage(text) {
  try {
    fs.writeFileSync(privateMessageFilePath, text, 'utf-8');
    console.log('Mensaje privado guardado.');
  } catch (err) {
    console.error('Error al guardar privado.txt:', err);
  }
}

module.exports = {
  loadConfig,
  saveConfig,
  loadAllowedGroups,
  saveAllowedGroups,
  loadBanner,
  saveBanner,
  loadPrivateMessage,
  savePrivateMessage
};
