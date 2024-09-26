const { createClient } = require('redis');

// Create a Redis client
const client = createClient({
    url: 'redis://default:BGQqM4OReyeXHoG0PiajQwnNfG5zTwyj@redis-19905.c73.us-east-1-2.ec2.redns.redis-cloud.com:19905'
});

// Handle errors
client.on('error', (err) => {
    console.error('Redis error:', err);
});

// Connect to Redis
client.connect()
    .then(() => {
        console.log('Connected to Redis');
    })
    .catch((err) => {
        console.error('Failed to connect to Redis:', err);
    });

module.exports = client;
