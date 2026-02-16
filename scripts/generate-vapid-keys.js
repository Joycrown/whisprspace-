const webpush = require('web-push')

const keys = webpush.generateVAPIDKeys()

console.log('Add these values to your environment variables:')
console.log('')
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
console.log('VAPID_SUBJECT=mailto:support@whisprspace.com')

