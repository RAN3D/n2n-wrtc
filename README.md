# n2n-wrtc [![Build Status](https://travis-ci.org/RAN3D/n2n-wrtc.svg?branch=master)](https://travis-ci.org/RAN3D/n2n-wrtc)

**Keywords:** WebRTC, browser-to-browser communication, overlay networks

Create and manage connections over a network using signaling services and communication wrappers.

For the moment a WebRTC and a Bluetooth wrapper is included, but other wrapper can be used following the same API.

**NB1:** Build for browsers and Node (v8.11.1+)

**NB:** This package is a replacement package for n2n-overlay-wrtc and neighborhood-wrtc
This allows to do the same job but the package is completely rebuilt from scratch for simplicity.

## Install

```
npm install --save n2n-wrtc
```

## Usage

In the browser the library is available through the name n2n

In NodeJs just do `const n2n = require('n2n')`

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

## Overview of available functionalities
- [ ] Create the API
- [ ] Create WebRTC Wrapper using ([simple-peer](https://github.com/feross/simple-peer))
- [ ] Create Bluetooth Wrapper using ([sabertooth](http://sabertooth-io.github.io/))
- [ ] Create the Signaling service for the very first connection (the entrance)
- [ ] Create the internal signaling service
- [ ] Create bridge connections
- [ ] Create from -> to connections
- [ ] Create to -> from connections
- [ ] Encapsulate each message sent for distinguish admin messages from application messages
- [ ] Minimize the encapsulation
- [ ] Control the size of the object sent and create a mechanism to handle bigger files (chunkification)
- [ ] Allows each method to be customizable
- [ ] (Optionnal) Allows for hooks before sending and after sending messages
