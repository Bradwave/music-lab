// Entry point for 3AM — Berlin 3 AM Microhouse 4-Track Tape Loom.

import { loadFromLocalStorage, showStatus } from './state/store.js';
import { initAppView } from './ui/appView.js';

loadFromLocalStorage();
initAppView();
showStatus('PRESS PLAY · TAP TAPE', 2600);
