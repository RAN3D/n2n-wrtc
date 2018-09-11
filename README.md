# n2n-wrtc

Keywords: WebRTC, browser-to-browser communication, overlay network

Create and manage connections over the network using signaling services and (WebRTC) wrappers.

This package is a replacement package for n2n-overlay-wrtc and neighborhood-wrtc
This allows to do the same job but the package is completely rebuilt from scratch.

## Neighborhood 

Project that aims to ease the WebRTC connection establishment process. Among others, it alleviates the need to know which socket produced which offer. It also reuses existing connections instead of establishing new ones, when this is possible. It aims to be part of network protocols that build overlay networks and to provide them logical arcs - using identifiers - instead of channels. Finally, it is designed to handle multiple protocols, for they may share identical arcs. For instance, consider several applications embedded in a single web page, some of them are connected to a same peer. Instead of working completely on their own, these applications will share the same channel. The neighborhood-wrtc module will redirect the messages to the right applications.

## Neighborhood-toNeighborhood (N2N)

This project aims to ease the creation of overlay networks on top of WebRTC. Additional WebRTC-specific constraints make such projects more difficult than they should be. For instance, establishing a connection requires a round-trip of "offers". Such messages usually transit a dedicated signaling server. The peers of this project still require a signaling server for their entrance in the network. Afterwards, peers become signaling servers too, i.e., they mediate connections between their direct neighbors.

This module divides the entering arcs (inview) from the outgoing arcs (outview).

The way connections are handled are left to the discretion of overlay protocols built on top of this module. A peer with two neighbors can ask to one of them to connect to the other. Several overlay network protocols use neighbor-to-neighbor interactions to converge to a topology exposing the desired properties.

