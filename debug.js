const { GET } = require('./frontend/src/app/api/data/[uuid]/route.js'); // Cannot require TS file in Node directly without compilation

console.log("This won't work in raw Node without transpiling");
