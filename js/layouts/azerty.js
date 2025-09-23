// js/layouts/azerty.js
window.layouts = window.layouts || {};
window.layouts.azerty = {
  '2': 'C#4', '3': 'D#4', '5': 'F#4', '6': 'G#4', '7': 'A#4', '9': 'C#5', '0': 'D#5', '=': 'F#5', '-': 'G#5',

  // верхний ряд (физически Q W E R T Y U I O P [ ] на QWERTY)
  // в AZERTY на тех же физических клавишах: A Z E R T Y U I O P ^ $
  A: 'C4', Z: 'D4', E: 'E4', R: 'F4', T: 'G4', Y: 'A4', U: 'B4', I: 'C5', O: 'D5', P: 'E5', '^': 'F5', '$': 'G5',

  // средний ряд (физически A S D F G H J K L ; ')
  Q: 'C#3', S: 'D#3', D: 'F#3', F: 'G#3', G: 'A#3', H: 'C#4', J: 'D#4', K: 'E4', L: 'F4', M: 'G4', '%': 'G#4',

  // нижний ряд (физически Z X C V B N M , . /)
  W: 'C3', X: 'D3', C: 'E3', V: 'F3', B: 'G3', N: 'A3', ',': 'B3', ';': 'C4', ':': 'D4', '!': 'E4'
};
