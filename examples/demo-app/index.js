/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

global.__REACT_NATIVE_MCP__?.enable();

AppRegistry.registerComponent(appName, () => App);
