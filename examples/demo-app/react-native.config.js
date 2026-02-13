const path = require('path');
const fs = require('fs');

const packageName = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).name;

module.exports = {
  dependencies: {
    [packageName]: { root: __dirname },
  },
};
