// Test file to verify eventController exports
const eventController = require('./controllers/eventController');

console.log('Exported functions:');
console.log(Object.keys(eventController));

// Test if functions exist
const expectedFunctions = [
  'createEvent',
  'getAllEvents',
  'getEventById',
  'updateEvent',
  'deleteEvent',
  'registerForEvent',
  'cancelRegistration',
  'getMyRegistrations',
  'getMyEvents',
  'getEventStats'
];

expectedFunctions.forEach(fn => {
  if (typeof eventController[fn] === 'function') {
    console.log(`✓ ${fn} exists`);
  } else {
    console.log(`✗ ${fn} MISSING`);
  }
});
