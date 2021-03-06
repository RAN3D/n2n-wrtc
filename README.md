# n2n-wrtc [![Build Status](https://travis-ci.com/RAN3D/n2n-wrtc.svg?branch=master)](https://travis-ci.com/RAN3D/n2n-wrtc) [![Gitter chat](https://badges.gitter.im/gitterHQ/gitter.png)](https://gitter.im/ran3d/n2n-wrtc)

**Keywords:** WebRTC, browser-to-browser communication, overlay networks

Create and manage connections over a network using signaling services and communication wrappers.

 **Link** to the [list of features available](#features)

For the moment a **WebRTC** wrapper is included, but other wrapper can be used following the same API.

**NB1:** Build for browsers and Node (v8.12.0+)

**NB:** This package is a replacement package for n2n-overlay-wrtc and neighborhood-wrtc
This allows to do the same job but the package is completely rebuilt from scratch for simplicity.

## Install

```
npm install --save n2n-wrtc
```

## Usage

Just add in your index.html:
```js
<script type='text/javascript' src='./node_modules/n2n-wrtc/bin/n2n-wrtc.bundle.min.js'></script>
```

Then the library is available through the name **n2n**

In **NodeJs** just do `const n2n = require('n2n')`

Now an example of how to using it (without the signaling server):

```javascript
const N2N = n2n.N2N // get the N2N class

const a = create('a')
const b = create('b')
const c = create('c')

async function start() {
  await b.connect(a)
  await c.connect(b)
  await b.bridgeOI(a.id, c.id)
}

async().then(() => {
  console.log('B is connected to A')
  console.log('C is connected to B')
  console.log('A is connected to C using B as forwarding peer.')
})

function create(id) {
  return new N2N({
    n2n: {
      id
    },
    socket: {
      trickle: true,
      moc: true
    }
  })
}
```

Using the signaling server you can just do `npm run signaling` and put `signaling: {room: 'myroom', address: 'http://localhost:5555'}` and then call `a.connect()` and `b.connect()` to connect b to a.

## Neighborhood

Project that aims to ease the WebRTC connection establishment process. Among others, it alleviates the need to know which socket produced which offer. It also reuses existing connections instead of establishing new ones, when this is possible. It aims to be part of network protocols that build overlay networks and to provide them logical arcs - using identifiers - instead of channels. Finally, it is designed to handle multiple protocols, for they may share identical arcs. For instance, consider several applications embedded in a single web page, some of them are connected to a same peer. Instead of working completely on their own, these applications will share the same channel. The neighborhood-wrtc module will redirect the messages to the right applications.

### Principle

<p align="center">
<img src='./assets/img/notsharing.png#center' />
</p>

Three peer-to-peer applications ```8O```, ```:|``` and ```>_<``` run in a same
tab of a WebRTC-compatible browser. When they want to connect to their
respective remote counterpart, the browser must establish 3 WebRTC connections,
for they do not share any information between each other.

<p align="center">
<img src='./assets/img/sharing.png#center' />
</p>


Using this module to create WebRTC connections, they can share it and messages
will be automatically redirected to corresponding applications. In this example,
instead of establishing and maintaining 3 distinct connections -- which may be
costly in terms of time and bandwidth -- neighborhood-wrtc only establish 1. The
connection is destroyed only if the 3 applications remove it.

## Neighborhood-to-Neighborhood (N2N)

This project aims to ease the creation of overlay networks on top of WebRTC. Additional WebRTC-specific constraints make such projects more difficult than they should be. For instance, establishing a connection requires a round-trip of "offers". Such messages usually transit a dedicated signaling server. The peers of this project still require a signaling server for their entrance in the network. Afterwards, peers become signaling servers too, i.e., they mediate connections between their direct neighbors.

This module divides the entering arcs (inview) from the outgoing arcs (outview).

The way connections are handled are left to the discretion of overlay protocols built on top of this module. A peer with two neighbors can ask to one of them to connect to the other. Several overlay network protocols use neighbor-to-neighbor interactions to converge to a topology exposing the desired properties.

### Principle

<p align="center">
<img src='./assets/img/signal.png#center' />
</p>

There exists a network comprising at least Peer ```:|```. Peer ```:]``` wants to
join this network. ```:|``` knows it and opens an access to the network thanks
to a signaling server. The signaling server is in charge of transmitting the
necessary WebRTC data from both sides. The figure shows this protocol with the
1->2->3->4 steps that can be repeated many times depending on network
configurations. If the protocol is successful, it creates a direct
browser-to-browser connection from ```:]``` to ```:|```.

<p align="center">
<img  src='./assets/img/bridge.png#center' />
</p>

Peers already in the network do not need to use a signaling server to establish
connections, for each of them can act as a signaling server, i.e. as a bridge
from a neighbor to another. In the figure, `:3`, `:]`, and `:|` are
in the network. `:3` can establish a WebRTC connection to `:|` using
`:]`. Such neighbor-to-neighbor connections are common in distributed
peer-sampling protocols.

## Overview of available functionalities <a name='features'></a>
- [x] Create the API (api for neighborhood, signaling services, n2n and sockets)
- [x] Create WebRTC Wrapper using ([simple-peer](https://github.com/feross/simple-peer))
- [ ] Create Bluetooth Wrapper using ([sabertooth](http://sabertooth-io.github.io/))
- [x] **Offline signaling** allowing to do `a.connect(b)`
- [x] **Signaling server** for online signaling
  - `npm run signaling` or
  - `require('n2n-wrtc/lib/signaling/server').server()`
- [x] **Online signaling** allowing to do `a.connect()` using a signaling server
- [x] **Get a list of all neighbours (not locked)**:  
  - `a.getNeighbours()`
- [x] **Get a list of all neighbours (even if locked)** `a.getAllNeighbours(true)`
- [x] **Get a list of all neighbours ids (locked/ not locked)** (outview):
  - `a.getNeighboursIds([true/false])`
- [x] **Get only inview ids**:
  - `a.getNeighboursInview()`
- [x] **Get only outview ids (not locked)**: `a.getNeighboursOutview()`
- [x] **Send** a message over Unicast and the received message will be emit on the specified event (here: 'receive'):
  - `a.send('receive', b.id, 'meow');`
- [x] **Listen on incoming messages**:
  - `b.on('receive', (id, message) => ...);`
- [x] Create the internal signaling service:
  - Allow to forward offers from an inview neighbour to an outview neighbour
  - After connection new offers are transmitted by message (usefull for re-negociation)
- [x] Create from -> to connections allowing to do: `a.connectFromUs(b.id)`
  - **b.id need to be in our outview**
  - It means that it increments our outview, not the inview of the neighbor
- [x] Create a Direct signaling service
- [x] Create to -> from connections `a.connectToUs(b.id)`
  - **b.id need to be in our outview**
  - It means that it does the same thing than from -> to but from the neighbor: `a.connectFrom(b.id)`
  - If the connection does not exist, create the connection using the direct signaling service
- [x] `a.connect4u(<id>, <id>)` choose for you what kind of method to apply for performing the connection for you.
  - Be carefull, if a bridge is done, it is a bridge where from is in your inview and dest is in your outview.
  - For more choices, see `bridgeOO(...)` and `bridgeOI(...)` methods.
- [ ] Ice Re-negociation, when a peer is connected, new offers are transferred using the connection.
- [ ] Encapsulate each message sent for distinguish admin messages from application messages
- [ ] Minimize the encapsulation
- [ ] Control the size of the object sent and create a mechanism to handle bigger files (chunkification)


## Turn and Stun servers (for tests purposes only)

For production purposes see (https://www.twilio.com/stun-turn)

- a stun server is available through `node-stun-server` [node-stun](https://github.com/enobufs/stun)
  - check the node-stun.ini in tests/stun folder.
  ```javascript
  const iceServers = {
    url: 'stun:127.0.0.1:3478'
  }
  ```

- a turn server is available through a Dockerfile
  - check the Dockerfile in the tests/turn folder.
  ```javascript
  const iceServers = {
    urls: 'turn:127.0.0.1:3478?transport=udp'
    username: 'username',
    password: 'password'
  }
  ```
