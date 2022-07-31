package room

import (
	"encoding/json"
	"fmt"
	socketIO "github.com/googollee/go-socket.io"
	"net/http"
)

// UserRoomInfo 用户房间信息
type UserRoomInfo struct {
	RoomId   string `json:"roomId"`
	UserName string `json:"userName"`
}

// LiveServer 直播服务
type LiveServer struct {
	server       *socketIO.Server
	staticPath   string
	port         string
	httpNSpace   string
	serverNSpace string
}

func BuildLiveServer() *LiveServer {
	liveServer := &LiveServer{}
	liveServer.staticPath = "如果本地debug，这里选择本地静态文件地址"
	liveServer.port = ":8080"
	liveServer.httpNSpace = "/socket.io/"
	liveServer.serverNSpace = "/socket.io"
	return liveServer
}

func (l *LiveServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	origin := r.Header.Get("Origin")
	w.Header().Set("Access-Control-Allow-Origin", origin)
	l.server.ServeHTTP(w, r)
}

// StartHost 开始host
func (l *LiveServer) StartHost() {
	l.server = socketIO.NewServer(nil)
	l.server.OnConnect("/", func(conn socketIO.Conn) error {
		fmt.Printf("connected. sid:%v", conn.ID())
		return nil
	})
	l.server.OnDisconnect(l.serverNSpace, func(conn socketIO.Conn, s string) {
		fmt.Printf("disconnect sid \n :%v", conn.ID())
	})
	l.server.OnError(l.serverNSpace, func(conn socketIO.Conn, err error) {
		fmt.Printf("error \n %v", err)
	})
	//加入房间
	l.server.OnEvent(l.serverNSpace, "join-room", l.joinRoom)
	//peer 广播
	l.server.OnEvent(l.serverNSpace, "broadcast", l.broadcast)

	go l.server.Serve()
	defer l.server.Close()

	http.Handle(l.httpNSpace, l)
	//http.Handle("/", http.StripPrefix("/", http.FileServer(http.Dir(l.staticPath))))

	fmt.Printf("serving ok.port:%s", l.port)

	err := http.ListenAndServe(l.port, nil)
	if err != nil {
		fmt.Printf("listen err. %v", err)
	}
}

//加入房间
func (l *LiveServer) joinRoom(conn socketIO.Conn, msg string) {
	var userRoomInfo UserRoomInfo
	err := json.Unmarshal([]byte(msg), &userRoomInfo)
	if err != nil {
		fmt.Printf("join room .%v", err)
		return
	}
	fmt.Printf("jon room.%v", userRoomInfo)
	l.server.JoinRoom("/socket.io", userRoomInfo.RoomId, conn)
	l.broadcastTo(l.server, conn.Rooms(), "user-joined", userRoomInfo.UserName)
}

//处理广播
func (l *LiveServer) broadcast(conn socketIO.Conn, msg interface{}) {
	l.broadcastTo(l.server, conn.Rooms(), "broadcast", msg)
}

//广播房间事件
func (l *LiveServer) broadcastTo(server *socketIO.Server, rooms []string, event string, msg interface{}) {
	fmt.Printf("broadcast to .\n %v \n", msg)
	if len(rooms) == 0 {
		fmt.Println("broadcast rooms is null.")
		return
	}
	for _, room := range rooms {
		server.BroadcastToRoom("/socket.io", room, event, msg)
	}
}
