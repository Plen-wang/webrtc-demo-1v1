FROM golang:1.16
WORKDIR /app
COPY go.mod ./
COPY go.sum ./
RUN go mod download
COPY rtc-server .
RUN go build -o /rtc-signal-server
EXPOSE 8080
CMD [ "/rtc-signal-server" ]

