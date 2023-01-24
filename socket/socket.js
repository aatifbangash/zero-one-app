exports = module.exports = function (io) {
  function slug(Text) {
    return Text.toLowerCase()
      .replace(/[^\w ]+/g, "")
      .replace(/ +/g, "-");
  }

  // number of room (dynamically created) array
  let rooms = [];

  // total number players array
  var players = [];

  // total number of players per room
  let numberOfPlayers = 7;

  // game default count down
  let DefaultCountDownSec = 15;

  // when socket connection established successfully, following (connection) event will occur
  io.on("connection", (socket) => {
    // on player username received
    socket.on("playerJoin", (playerName) => {
      // push user data into the players array
      players.push({
        id: socket.id,
        playerId: slug(playerName),
        name: playerName,
        timestamp: new Date().getTime(),
        socketData: socket,
        state: "",
        numberChoosen: 0,
      });

      // if players array size reached to the number of player per room limit
      if (players.length == numberOfPlayers) {
        // generate roomId
        var roomId = `room_${new Date().getTime()}`;

        // pushed users into the rooms array
        rooms.push({
          roomId: roomId,
          timestamp: new Date().getTime(),
          roomPlayers: players.splice(0, numberOfPlayers),
        });

        // filter rooms and join users into the socket io room to communicate with one another
        rooms
          .filter((room) => room.roomId == roomId)
          .forEach((room) => {
            room.roomPlayers.forEach((player) => {
              // joined player to socket room
              player.socketData.join(roomId);

              // send room information to clients/users
              io.to(player.socketData.id).emit("roomPayload", {
                roomId: room.roomId,
                id: player.id,
                name: player.name,
                playerId: player.playerId,
                countDown: DefaultCountDownSec,
                allPlayers: room.roomPlayers.map((player) => {
                  return {
                    id: player.id,
                    name: player.name,
                    roomId: roomId,
                  };
                }),
              });
            });
          });
      }
    });

    // decide the winners and losers
    function setWinnerAndLosers(roomId) {
      let totalZeros = null;
      let totalOnes = null;
      rooms
        .filter((room) => room.roomId == roomId)
        .forEach((room) => {
          room.roomPlayers.forEach((player) => {
            if (player.numberChoosen == 0) totalZeros++;
            if (player.numberChoosen == 1) totalOnes++;
          });
        });

      rooms
        .filter((room) => room.roomId == roomId)
        .map((room) => {
          room.roomPlayers.map((player) => {
            if (player.numberChoosen == 2) return;
            if (totalZeros > totalOnes) {
              if (player.numberChoosen == 1) {
                player.state = "wins";
              } else {
                player.state = "lose";
              }
            }

            if (totalOnes > totalZeros) {
              if (player.numberChoosen == 0) {
                player.state = "wins";
              } else {
                player.state = "lose";
              }
            }

            if (
              totalOnes == null ||
              totalZeros == null ||
              totalOnes == totalZeros
            ) {
              player.state = "";
            }
          });
        });
    }

    // remove game room after game finish
    socket.on("removeRoom", (roomId) => {
      let roomIndex = rooms.filter((room) => room.roomId == roomId);
      rooms.splice(roomIndex, 1);
    });

    // receive payload from clients on click
    socket.on("clientSendPayload", (clientPayloadData) => {
      rooms.map((room) => {
        if (room.roomId == clientPayloadData.roomId) {
          room.roomPlayers.map((player) => {
            if (player.id == clientPayloadData.id) {
              player.numberChoosen = clientPayloadData.numberChoosen;

              setWinnerAndLosers(room.roomId);
            }
          });
        }
      });
    });

    // player quit the game.
    socket.on("playerQuit", (clientPayloadData) => {
      rooms.map((room) => {
        if (room.roomId == clientPayloadData.roomId) {
          room.roomPlayers.map((player) => {
            if (player.id == clientPayloadData.id) {
              player.stoped = true;
            }
          });
        }
      });

      var totalPlayersInRoom = 0;
      var totalPlayersStopedInRoom = 0;
      rooms.map((room) => {
        if (room.roomId == clientPayloadData.roomId) {
          totalPlayersInRoom = room.roomPlayers.filter(
            (player) => player.state == "" || player.state == "wins"
          ).length;

          room.roomPlayers.forEach((player) => {
            if (
              player.stoped != undefined &&
              player.stoped == true &&
              (player.state == "" || player.state == "wins")
            ) {
              totalPlayersStopedInRoom++;
            }
          });
        }
        var halfPlayers = Math.round(totalPlayersInRoom / 2);
        if (totalPlayersStopedInRoom >= halfPlayers) {
          var result = [];
          room.roomPlayers.forEach((player) => {
            if (player.state == "lose") return;
            result.push({
              roomId: room.roomId,
              id: player.id,
              name: player.name,
              playerStoped:
                player.stoped != undefined && player.stoped == true
                  ? true
                  : false,
            });
          });

          room.roomPlayers.forEach((player) => {
            io.to(player.socketData.id).emit("gameStopped", result);
          });
        }
      });
    });

    // player quit the game.
    socket.on("playerContinue", (clientPayloadData) => {
      rooms.map((room) => {
        if (room.roomId == clientPayloadData.roomId) {
          room.roomPlayers.map((player) => {
            if (player.id == clientPayloadData.id) {
              player.numberChoosen = 2;
              player.state = "skiped";
            }
          });
        }
      });
    });

    // make the losers out of the game
    socket.on("losser", (losserObject) => {
      rooms.map((room) => {
        if (room.roomId == losserObject.roomId) {
          room.roomPlayers.map((player) => {
            if (player.id == losserObject.id) {
              player.numberChoosen = 2;
            }
          });
        }
      });
    });

    // fetch winners to display on the winner page.
    socket.on("fetchWinners", (roomId, callback) => {
      var winnersList = [];
      rooms
        .filter((room) => room.roomId == roomId)
        .forEach((room) => {
          let winners = room.roomPlayers.forEach((player) => {
            if (player.state == "wins") {
              winnersList.push({
                name: player.name,
              });
            }
          });
          callback(winnersList);
        });
    });

    // fetch result once count down finish
    socket.on("fetchResult", (roomId, callback) => {
      var playersResult = [];
      rooms
        .filter((room) => room.roomId == roomId)
        .forEach((room) => {
          // set number choosen by each player of the room
          room.roomPlayers.forEach((player) => {
            playersResult.push({
              id: player.id,
              playerId: player.playerId,
              name: player.name,
              roomId: room.roomId,
              state: player.state,
              numberChoosen: player.numberChoosen,
              countDown: DefaultCountDownSec,
            });
          });
        });

      let totalWinners = 0;
      playersResult.forEach((player) => {
        if (player.state == "wins") totalWinners++;
        if (player.state == "skiped") totalWinners--;
      });

      callback({
        finalState: totalWinners > 0 && totalWinners <= 2 ? "gameEnd" : "",
        playersResult: playersResult,
      });
    });

    // remove player from the player array after he/she reload or close the browser window
    socket.on("disconnect", () => {
      let idx = players.findIndex((player) => player.id == socket.id);
      if (idx != -1) {
        players.splice(idx, 1);
      }
    });
  });
};
