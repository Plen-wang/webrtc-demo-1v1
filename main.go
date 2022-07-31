package main

import (
	"github.com/webrtc-demo-1v1/room"
)

func main() {
	room.BuildLiveServer().StartHost()
}
