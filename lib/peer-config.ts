import type { PeerOptions } from 'peerjs';

// Same signalling and relay setup used successfully by the Directo tools.
export const peerOptions: PeerOptions = {
  host: '0.peerjs.com',
  port: 443,
  path: '/',
  secure: true,
  debug: 1,
  config: {
    iceServers: [
      { urls: 'stun:stun.relay.metered.ca:80' },
      {
        urls: 'turn:standard.relay.metered.ca:80',
        username: '9745e21b303bdaea589c29bc',
        credential: 'UgG56tBqCEGNjzLY',
      },
      {
        urls: 'turn:standard.relay.metered.ca:443?transport=tcp',
        username: '9745e21b303bdaea589c29bc',
        credential: 'UgG56tBqCEGNjzLY',
      },
    ],
    iceTransportPolicy: 'all',
  },
};
