//Author: Corentin Guichaoua

// Vue.config.devtools = true
// Vue.config.performance = true


// ============================================================================

// Reload the screen after 2 minutes of inactivity.
let timeout = null;
function restartTimeout() {
  clearTimeout(timeout);
//   timeout = setTimeout(() => window.location.reload(), 1000 * 120); // 2 mins
}
document.addEventListener('touchdown', restartTimeout);
document.addEventListener('mousemove', restartTimeout);
//An additional listener is added upon connecting a Midi Input

// ============================================================================
// Geometry constants and coordinate conversions

const xstep=Math.sqrt(3)/2 //Ratio of horizontal to vertical spacing = height of an equilateral triangle
const baseSize=50 //Base scale: height of a vartical step (in svg coordinates)

// Conversion between tonnetz coordinates and svg coordinates
const logicalToSvgX = node => node.x * xstep * baseSize;
const logicalToSvgY = node => (node.y + node.x/2) * baseSize;
const logicalToSvg = node => ({x:logicalToSvgX(node), y:logicalToSvgY(node)})


// ============================================================================
// Vue components and mixins

var piano; //Variable to hold the virtual piano (built later once JZZ is loaded)
//var midiBus; //Variable to hold the bus for upgoing midiEvents (built once Vue is loaded)
var proto; //Variable to hold the main app Object (built once everything is loaded)



// Global object to store recording and its state
var record = {
    startTime:undefined,
    SMF:undefined,
    recording:false
}

// Wait for libraries to be loaded
fallback.ready(function(){

// The App's main object, handling global concerns
proto = new Vue({
    el: '#proto',
    components: {clockOctave,songLoader,pianoKeyboard,playRecorder,tonnetzView,languageSelector,intervalTable},
    data: {
        // The list of all 3-interval Tonnetze
        tonnetze: tonnetze3,
        // The selected interval set
        intervals: tonnetze3[9],
        // The type of representation for the main window ('tonnetz' or 'chicken')
        type: 'tonnetz',
        // The list of all notes: their name and their status
        notes: Array.from(Array(12),(_x,index) => ({id:index,count:0})),
        // notes: (strings[language] || strings.en).notes.map( function(note_name_local, index) { 
        //     // use text for display and id for CSS styling
        //     return {text: note_name_local, id: strings.en.notes[index], count: 0};
        // }),
        // Synthetiser engine
        synth: JZZ.synth.Tiny(),
        //synth:JZZ.synth.MIDIjs({ 
            //TODO: Use a soundfont from our own server
            //soundfontUrl: "https://raw.githubusercontent.com/mudcube/MIDI.js/master/examples/soundfont/", 
            //instrument: "acoustic_grand_piano" })
                //.or(function(){ proto.loaded(); alert('Cannot load MIDI.js!\n' + this.err()); })
                //.and(function(){ proto.loaded(); }),
        

  
        // QWERTY keyboard bindings - More intuitive layout
        // ascii: JZZ.input.ASCII({
        //     '2': 'C#4', '3': 'D#4', '5': 'F#4', '6': 'G#4', '7': 'A#4','9': 'C#5', '0': 'D#5', '=': 'F#5', '-': 'G#5',
        //     Q: 'C4', W: 'D4', E: 'E4', R: 'F4', T: 'G4', Y: 'A4', U: 'B4',I: 'C5', O: 'D5', P: 'E5', '[': 'F5', ']': 'G5',
        //     S: 'C#3', D: 'D#3', G: 'F#3', H: 'G#3', J: 'A#3', L: 'C#4',  ';': 'D#4',
        //     Z: 'C3', X: 'D3', C: 'E3', V: 'F3', B: 'G3', N: 'A3', M: 'B3',',': 'C4', '.': 'D4', '/': 'E4'
        // }),

        keyStates: {},
        layouts: window.layouts || {},       // берём глобально созданные раскладки
        currentLayout: 'tg',
        // currentLayout: 'qwerty',
        ascii: null,
        

        // Should trajectory drawing be active?
        trace: false,
        // The localisation strings
        allStrings: strings,
        // The picked locale
        language: language || en
    },
    computed:{
        complementNotes: function(){
            return this.notes.map(note => ({id:note.id, count:note.count?0:1}));
        },
        strings: function(){
            return strings[this.language]
        }
    },
    created: function(){
        //Delay connection of MIDI devices to let JZZ finish its initialisation
        let deviceUpdate=this.deviceUpdate; // This is required to bring deviceUpdate into the lambda's context
        setTimeout(function(){deviceUpdate({inputs:{added:JZZ().info().inputs}})},1000);
        //Add a watcher to connect (and disconnect) new devices to the app
        JZZ().onChange(this.deviceUpdate);
    },

    methods:{
        //Handler for JZZ device change event
        deviceUpdate: function({inputs:{added,removed}}){
            console.log('Updating MIDI devices');
            if(added){
                for(device of added){
                    JZZ().openMidiIn(device.name)
                    .connect(midiBus.midiThru) // Send the keyboard's events to the midi bus which will relay them
                    .connect(restartTimeout); // Reset the page's timeout upon input
                    console.log('Added device: ',device);
                }
            }
            if(removed){
                for(device of removed){
                    JZZ().openMidiIn(device.name).disconnect(midiBus.midiThru);
                    console.log('Removed device: ',device);
                }
            }
            this.resetNotes(); // Connection/Disconnection can cause unbalanced note events
        },
        
        //Handler for Midi events coming from JZZ
        midiHandler: function (midiEvent){
            console.log('=== MIDI Event ===');
            console.log('Type:', midiEvent.isNoteOn() ? 'NOTE_ON' : 'NOTE_OFF');
            console.log('Note:', midiEvent.getNote(), 'Channel:', midiEvent.getChannel());
            console.log('Velocity:', midiEvent[2]);
            
            noteIndex = (midiEvent.getNote()+3) %12;
            
            if(midiEvent.isNoteOn()){
                console.log('Before increment - note', noteIndex, 'count:', this.notes[noteIndex].count);
                this.notes[noteIndex].count++;
                console.log('After increment - count:', this.notes[noteIndex].count);
            }else if(midiEvent.isNoteOff()){
                console.log('Before decrement - note', noteIndex, 'count:', this.notes[noteIndex].count);
                if(this.notes[noteIndex].count > 0){
                    this.notes[noteIndex].count--;
                }else{
                    console.log('⚠️ Warning: ignored unbalanced noteOff event', midiEvent);
                }
                console.log('After decrement - count:', this.notes[noteIndex].count);
            }
            
            // Показываем общее состояние активных нот
            let activeNotes = this.notes.filter(n => n.count > 0).map((n,i) => `${i}:${n.count}`);
            console.log('Active notes:', activeNotes.join(', '));
        },

        // Новый метод для обхода ограничений браузера на клавиатуру
        setupKeyboardOverride: function() {
            const self = this;
            const layout = this.layouts[this.currentLayout];
            
            // Отключаем стандартный ASCII input
            if (this.ascii) {
                this.ascii.disconnect();
            }
            
            // Создаем собственную обработку клавиатуры
            document.addEventListener('keydown', function(e) {
                let char = e.key;
                
                // Обработка цифровых клавиш
                if (e.code.startsWith('Digit')) {
                    char = e.key;
                } else {
                    char = e.key.toUpperCase();
                }
                
                // Проверяем есть ли эта клавиша в раскладке
                if (layout[char] && !self.keyStates[char]) {
                    self.keyStates[char] = true;
                    const note = JZZ.MIDI.noteValue(layout[char]);
                    const midiEvent = JZZ.MIDI.noteOn(0, note, 127);
                    midiBus.midiThru.receive(midiEvent);
                    console.log('Direct keydown:', char, '→', layout[char]);
                    e.preventDefault();
                }
            });
            
            document.addEventListener('keyup', function(e) {
                let char = e.key;
                
                // Обработка цифровых клавиш
                if (e.code.startsWith('Digit')) {
                    char = e.key;
                } else {
                    char = e.key.toUpperCase();
                }
                
                if (layout[char] && self.keyStates[char]) {
                    self.keyStates[char] = false;
                    const note = JZZ.MIDI.noteValue(layout[char]);
                    const midiEvent = JZZ.MIDI.noteOff(0, note, 127);
                    midiBus.midiThru.receive(midiEvent);
                    console.log('Direct keyup:', char, '→', layout[char]);
                    e.preventDefault();
                }
            });
        },

        resetNotes: function(){
            for (note of this.notes){
                note.count = 0;
            }
        },
        
        traceToggle: function(){
            this.trace = !this.trace;
        },
        
        // Handlers for playback events fired from the app
        noteOn: function(pitches){
            //var notes = this.node2Notes(nodes);
            for (var pitch of pitches){
                midiBus.midiThru.noteOn(0,pitch,100);
            }
        },
        
        noteOff: function(pitches){
            //var notes = this.node2Notes(nodes);
            for (var pitch of pitches){
                midiBus.midiThru.noteOff(0,pitch,100);
            }
        },
        
        // Hard reset for the whole page
        reset(option) {
            if(option){
                window.location.search = '?hl='+option;
                console.log(window.location)
            }
            else{
                window.location.reload();
            }
        }
    },
    mounted(){

        if (this.layouts && this.layouts[this.currentLayout]) {
            this.ascii = JZZ.input.ASCII(this.layouts[this.currentLayout]);
            this.ascii.connect(midiBus.midiThru);
            //this.keyStates = {}; // Состояние всех клавиш
            //this.setupKeyboardOverride();
        }



        //Handle midiBus events
        midiBus.$on('note-on',this.noteOn);
        midiBus.$on('note-off',this.noteOff);

        //Connect the Midi
        this.ascii.connect(midiBus.midiThru);
        midiBus.midiThru.connect(this.synth);
        midiBus.midiThru.connect(this.midiHandler);   
    }
})

}) // fallback.ready