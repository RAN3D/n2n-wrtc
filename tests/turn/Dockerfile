FROM alpine:latest

WORKDIR /home

RUN apk add --no-cache bash gawk sed grep bc coreutils libc6-compat

ENV GOPATH /usr/local
ENV REALM localhost
ENV USERS username=password
ENV UDP_PORT 3478
EXPOSE 3478 3478/udp

RUN wget https://github.com/pions/turn/releases/download/1.0.3/simple-turn-linux-amd64
RUN chmod +x simple-turn-linux-amd64

ENTRYPOINT ["/home/simple-turn-linux-amd64"]
