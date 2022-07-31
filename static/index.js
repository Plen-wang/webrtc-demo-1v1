'use strict';


// set userName and  entry room.
var userName = prompt("set user name:");
var roomNumber = prompt("set and entry room number:");

// RTCPeerConnection 建立协商事件
const RTC_PEER_CONNECT_OFFER = 1001;
const RTC_PEER_CONNECT_ANSWER = 2001;
const RTC_PEER_CONNECT_CANDIDATE = 3001;
const RTC_PEER_CONNECT_HANGUP = 4001;

// RTCPeerConnection、MediaStream
var rtcConnObject;
var localStreamObject;

/////////////////////////////////////////////////////////////socket event bind.///////////////////////////////////////////////////////////////////////////////
// socket connect
var socket = io('http://公网ip:8080/socket.io');

if (roomNumber !== '') {
    console.log("join room :", userName, roomNumber)
    const args = {
        "roomId": roomNumber,
        "userName": userName
    };
    socket.emit("join-room", JSON.stringify(args))
}
socket.on("connect", function () {
    console.log("signal server connect ok.")
})
socket.on("user-joined", function (uName) {
    if (userName === uName) {//本用户跳过
        console.log("is current user skip ", uName, userName);
        return
    }
    console.log("user joined room:", uName);
})
socket.on("user-leave", function (uName) {
    if (userName === uName) {
        console.log("is current user skip.", uName, userName);
        return;
    }
    console.log("user leave room:", uName);
})

/////////////////////////////////////////////////////////////H5 element event bind.///////////////////////////////////////////////////////////////////////////////
//get video H5 object
var localVideo = document.querySelector("#localVideo");
var remoteVideo = document.querySelector("#remoteVideo");

//get and set local MediaStream
navigator.mediaDevices.getUserMedia({video: true, audio: true}).then(meStream => {
    console.log("get local MediaStream ok.");
    localVideo.srcObject = meStream;
    localStreamObject = meStream;
}).catch(err => {
    console.error("getUserMedia error.", err);
})
// 开始连线
document.getElementById("startCall").onclick = function () {
    console.log("start call. send offer to remote peer.");
    if (rtcConnObject == null) {
        createRTCPeerConnection();
    }
    //创建offer阶段
    rtcConnObject.createOffer(handleCreateOffer, function (event) {
        console.error("createOffer error.", event);
    });
}

//create Offer
function handleCreateOffer(sessionDescription) {
    try {
        console.log("createOffer send message:", sessionDescription);
        rtcConnObject.setLocalDescription(sessionDescription);//设置本地rtcConnObject对象session描述
        var message = {
            'userName': userName,
            'peerState': RTC_PEER_CONNECT_OFFER,
            'sdp': sessionDescription.sdp//包含会话描述协议
        }
        socket.emit("broadcast", message);
        console.log("createOffer send message ok.", message);
    } catch (e) {
        console.error(e)
    }
}

//结束连线
document.getElementById("endCall").onclick = function () {
    if (rtcConnObject == null) {
        return;
    }
    remoteVideo.srcObject = null;
    hangup();
    var message = {
        "userName": userName,
        "peerState": RTC_PEER_CONNECT_HANGUP
    }
    socket.emit("broadcast", message);
    console.log("send remote hangup message ok.");
}

/////////////////////////////////////////////////////////////RTCPeerConnection event 处理.///////////////////////////////////////////////////////////////////////////////
//RTCPeerConnection state loop.
socket.on("broadcast", function (msg) {
    console.log("broadcast receive .msg:", msg);
    if (userName === msg.userName) {
        console.log("is current user skip.", msg.userName);
        return;
    }
    switch (msg.peerState) {
        case RTC_PEER_CONNECT_OFFER:
            handleRemoteOffer(msg);
            break;
        case RTC_PEER_CONNECT_ANSWER:
            handleRemoteAnswer(msg);
            break;
        case RTC_PEER_CONNECT_CANDIDATE:
            handleRemoteCandidate(msg);
            break;
        case RTC_PEER_CONNECT_HANGUP:
            handleRemoteHangup(msg);
            break;
    }
})

// 处理远程offer事件
function handleRemoteOffer(msg) {
    console.log("receive remote offer", msg);
    if (rtcConnObject == null) {
        createRTCPeerConnection();
    }
    const sdpRemote = new RTCSessionDescription({sdp: msg.sdp, type: "offer"});//创建sdp协议
    rtcConnObject.setRemoteDescription(sdpRemote);
    //create answer
    rtcConnObject.createAnswer().then(function (sessionDescription) {
        console.log("create answer and send sdp", sessionDescription);
        rtcConnObject.setLocalDescription(sessionDescription);
        var message = {
            "userName": userName,
            "peerState": RTC_PEER_CONNECT_ANSWER,
            "sdp": sessionDescription.sdp
        }
        socket.emit("broadcast", message);
        console.log("create answer and send sdp ok.");
    })
}

//处理远程answer事件
function handleRemoteAnswer(msg) {
    console.log("receive remote answer.", msg);
    var sdp = new RTCSessionDescription({sdp: msg.sdp, type: "answer"});
    rtcConnObject.setRemoteDescription(sdp);
}

//处理远程candidate事件
function handleRemoteCandidate(msg) {
    console.log("receive remote candidate .", msg);
    var iceCandidate = new RTCIceCandidate({
        sdpMLineIndex: msg.sdpMLineIndex,
        sdpMid: msg.sdpMid
    });
    rtcConnObject.addIceCandidate(iceCandidate);
}

//处理远程用户挂断事件
function handleRemoteHangup() {
    console.log("receive remote hangup.");
    hangup();
}

/////////////////////////////////////////////////////////////公共方法///////////////////////////////////////////////////////////////////////////////
//挂断
function hangup() {
    console.log("hangup .");
    remoteVideo.srcObject = null;
    if (rtcConnObject != null) {
        rtcConnObject.close();
        rtcConnObject = null;
    }
}

//创建RTCPeerConnection对象
function createRTCPeerConnection() {
    try {
        const configuration = {'iceServers': [{'urls': 'stun:公网ip:3478?transport=tcp'}]}
        rtcConnObject = new RTCPeerConnection(configuration);
        rtcConnObject.onicecandidate = handleRtcICECandidate;//ice 交互
        rtcConnObject.onaddstream = handleRtcAddStream;//远程stream加入
        rtcConnObject.onremovestream = handleRtcRemoveStream;//远程stream移除
        rtcConnObject.addStream(localStreamObject);//添加本地stream
        console.log("create local RTCPeerConnection object ok.");
    } catch (e) {
        console.error("create RTCPeerConnection err.", e);
    }
}

//开始尝试ICE连接
function handleRtcICECandidate(iceEvent) {
    console.log("handle ICE candidate", iceEvent);
    if (iceEvent.candidate) {
        var message = {
            "userName": userName,
            "peerState": RTC_PEER_CONNECT_CANDIDATE,
            "sdpMid": iceEvent.candidate.sdpMid,
            "sdpMindLineIndex": iceEvent.candidate.sdpMLineIndex,
            "candidate": iceEvent.candidate
        };
        socket.emit("broadcast", message);
        console.log("send  ICE candidate message ok.");
    } else {
        console.log("ICE candidate close.");
    }
}

//远程rtc加流
function handleRtcAddStream(event) {
    console.log("handle remote add stream event.");
    remoteVideo.srcObject = event.stream;
}

//远程rtc移除流
function handleRtcRemoveStream(event) {
    console.log("handle remote remove stream event.", event);
    remoteVideo.srcObject = null;
}