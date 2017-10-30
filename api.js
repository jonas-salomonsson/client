'use strict';

const jsdom = require("jsdom");
const { JSDOM } = jsdom;

require("jsdom").env("", function(err, window) {
    if(err) {
        console.error(err);
        return;
    }

    var $ = require("jquery")(window);
});

var accountInfo = {};

var eventStreamInfo = {
    from: "END"
};
module.exports = {
    test: test,
    Setup: Setup,
    leaveRoom: leaveRoom,
    inviteUserToCurrentRoom: inviteUserToCurrentRoom,
    login: login,
    register: register,
    cRoom: cRoom,
    sendMessage: sendMessage
};

var roomInfo = [];
var memberInfo = [];
var viewingRoomId;

var host = "https://synapse.cynergit.nu";
var isSetup = false;
var user = "";
var botname = "";

var test = function(input) {
    return input;
};

var Setup = function (cfg_host, cfg_user, cfg_pass, cfg_botname) {
    host = cfg_host;
    user = cfg_user;
    botname = cfg_botname;
    isSetup = true;
    login(cfg_user, cfg_pass);
    console.log("Using bot: " + cfg_botname);
};

$('#minifier').live('click', function() {
    $(".roomListDashboard").toggleClass("minimized");
    $("#membersList").toggleClass("minimized");
    $("#client").toggleClass("clientSizer");
});

$('.setup').live('click', function() {
    Setup('https://synapse.cynergit.nu', 'jonas', 'hejsan12345', 'mybot');
});

var leaveRoom = function(name) {
    var url = host + "/_matrix/client/api/v1/rooms/" + name + "/leave?access_token=" + accountInfo.access_token;

    $.ajax({
        url: url,
        type: "POST",
        contentType: "application/json; charset=utf-8",
        success: function(data) {
            if(data==={}) {
                console.log("Left room: " + name);
                getCurrentRoomList();
            }
        },
        error: function(err) {
            alert("Unable to leave room: is the homeserver running?");  
        }
    }); 
};

$('.leaveRoom').live('click', function() {
    leaveRoom(viewingRoomId);
});

$('.inviteBot').live('click', function() {
    inviteUserToCurrentRoom(viewingRoomId, '@goneb:synapse.salle.space');
});

$('.inviteUser').live('click', function() {
    inviteUserToCurrentRoom(viewingRoomId);
});

var inviteUserToCurrentRoom = function(room_id, user_id) {
    if(!user_id) {
        user_id = $('').val();
    }
    var url = host + "/_matrix/client/api/v1/rooms/" + room_id + "/invite?access_token=" + accountInfo.access_token;
    var data = JSON.stringify({ user_id: user_id });

    $.ajax({
        url: url,
        data: data,
        type: "POST",
        contentType: "application/json; charset=utf-8",
        success: function(data) {
            if(data==={}) {
                console.log("Invited: " + user_id + " to room: " + room_id);
            }
        },
        error: function(err) {
            alert("Unable to invite user to room: is the homeserver running?");  
        }
    }); 
};

var longpollEventStream = function() {
    var url = host + "/_matrix/client/api/v1/events?access_token=$token&from=$from";
    url = url.replace("$token", accountInfo.access_token);
    url = url.replace("$from", eventStreamInfo.from);

    $.getJSON(url, function(data) {
        eventStreamInfo.from = data.end;
        
        var hasNewLatestMessage = false;
        var updatedMemberList = false;
        var i=0;
        var j=0;
        for (i=0; i<data.chunk.length; ++i) {
            if (data.chunk[i].type === "m.room.message") {
                console.log("Got new message: " + JSON.stringify(data.chunk[i]));
                if (viewingRoomId === data.chunk[i].room_id) {
                    addMessage(data.chunk[i]);
                }
                
                for (j=0; j<roomInfo.length; ++j) {
                    if (roomInfo[j].room_id === data.chunk[i].room_id) {
                        roomInfo[j].latest_message = data.chunk[i].content.body;
                        hasNewLatestMessage = true;
                    }
                }
            }
            else if (data.chunk[i].type === "m.room.member") {
                if (viewingRoomId === data.chunk[i].room_id) {
                    console.log("Got new member: " + JSON.stringify(data.chunk[i]));
                    addMessage(data.chunk[i]);
                    for (j=0; j<memberInfo.length; ++j) {
                        if (memberInfo[j].state_key === data.chunk[i].state_key) {
                            memberInfo[j] = data.chunk[i];
                            updatedMemberList = true;
                            break;
                        }
                    }
                    if (!updatedMemberList) {
                        memberInfo.push(data.chunk[i]);  
                        updatedMemberList = true;
                    }
                }
                if (data.chunk[i].state_key === accountInfo.user_id) {
                    getCurrentRoomList(); // update our join/invite list
                }
            }
            else {
                console.log("Discarding: " + JSON.stringify(data.chunk[i]));
            }
        }
        
        if (hasNewLatestMessage) {
           setRooms(roomInfo);
        }
        if (updatedMemberList) {
            $("#members").empty();
            for (i=0; i<memberInfo.length; ++i) { 
                addMember(memberInfo[i]);
            }
        }
        longpollEventStream();
    }).fail(function(err) {
        setTimeout(longpollEventStream, 5000);
    });
};

var onLoggedIn = function(data) {
    accountInfo = data;
    longpollEventStream();
    getCurrentRoomList();
    $(".roomListDashboard").css({visibility: "visible"});
    $(".roomContents").css({visibility: "visible"});
    $(".signUp").css({display: "none"});
    if (isSetup) {
        var roomName = user+(new Date().getMilliseconds().toString());
        console.log("Creating room: "+roomName);
        cRoom(roomName);
        isSetup = false;
    }
};

var login = function(user, password) {
    //host = $("#hostAddress").val();
    var url = host + "/_matrix/client/api/v1/login";
    console.log("host: " + host + " url: " + url);
    $.ajax({
        url: url,
        type: "POST",
        contentType: "application/json; charset=utf-8",
        data: JSON.stringify({ user: user, password: password, type: "m.login.password" }),
        dataType: "json",
        success: function(data) {
            onLoggedIn(data);
        },
        error: function(err) {
            alert("Unable to login: is the homeserver running?");  
        }
    }); 
};

$('.login').live('click', function() {
    var user = $("#userLogin").val();
    var password = $("#passwordLogin").val();
    login(user, password);
});

var register = function() {
    //host = $("#hostAddress").val();
    var user = $("#userReg").val();
    var password = $("#passwordReg").val();
    var url = host + "/_matrix/client/api/v1/register";
    console.log("host: " + host + " url: " + url);
    $.ajax({
        url: url,
        type: "POST",
        contentType: "application/json; charset=utf-8",
        data: JSON.stringify({ user: user, password: password, type: "m.login.password" }),
        dataType: "json",
        success: function(data) {
            onLoggedIn(data);
        },
        error: function(err) {
            var msg = "Is the homeserver running?";
            var errJson = $.parseJSON(err.responseText);
            if (errJson !== null) {
                msg = errJson.error;   
            }
            alert("Unable to register: "+msg);  
        }
    });
};

$('.register').live('click', function() {
    register();
});

var cRoom = function(roomAlias) {
    var data = {};
    if (roomAlias.length > 0) {
        data.room_alias_name = roomAlias;   
    }
    $.ajax({
        url: host + "/_matrix/client/api/v1/createRoom?access_token="+accountInfo.access_token,
        type: "POST",
        contentType: "application/json; charset=utf-8",
        data: JSON.stringify(data),
        dataType: "json",
        success: function(response) {
            $("#roomAlias").val("");
            response.membership = "join"; // you are automatically joined into every room you make.
            response.latest_message = "";
            
            roomInfo.push(response);
            setRooms(roomInfo);
            loadRoomContent(response.room_id);
        },
        error: function(err) {
            alert(JSON.stringify($.parseJSON(err.responseText)));  
        }
    }); 
};

var createRoom = function() {
    var roomAlias = $("#roomAlias").val();
    cRoom(roomAlias);
};

$('.createRoom').live('click', function() {
    createRoom();
});

var getCurrentRoomList = function() {
    var url = host + "/_matrix/client/api/v1/initialSync?access_token=" + accountInfo.access_token + "&limit=1";
    $.getJSON(url, function(data) {
        var rooms = data.rooms;
        for (var i=0; i<rooms.length; ++i) {
            if ("messages" in rooms[i]) {
                rooms[i].latest_message = rooms[i].messages.chunk[0].content.body;   
            }
        }
        roomInfo = rooms;
        setRooms(roomInfo);  
    }).fail(function(err) {
        alert(JSON.stringify($.parseJSON(err.responseText)));
    });
};

var loadRoomContent = function(roomId) {
    console.log("loadRoomContent " + roomId);
    viewingRoomId = roomId;
    $("#roomName").text("Room: "+roomId);
    $(".sendMessageForm").css({visibility: "visible"});
    getMessages(roomId);
    getMemberList(roomId);
};

var getMessages = function(roomId) {
    $("#messages").empty();
    var url = host + "/_matrix/client/api/v1/rooms/" + 
              encodeURIComponent(roomId) + "/messages?access_token=" + accountInfo.access_token + "&from=END&dir=b&limit=10";
    $.getJSON(url, function(data) {
        for (var i=data.chunk.length-1; i>=0; --i) {
            addMessage(data.chunk[i]);   
        }
    });
};

var getMemberList = function(roomId) {
    $("#members").empty();
    memberInfo = [];
    var url = host + "/_matrix/client/api/v1/rooms/" + 
              encodeURIComponent(roomId) + "/members?access_token=" + accountInfo.access_token;
    $.getJSON(url, function(data) {
        for (var i=0; i<data.chunk.length; ++i) {
            memberInfo.push(data.chunk[i]);
            addMember(data.chunk[i]);   
        }
    });
};

$('.sendMessage').live('click', function() {
    if (viewingRoomId === undefined) {
        alert("There is no room to send a message to!");
        return;
    }
    var body = $("#body").val();
    sendMessage(viewingRoomId, body);
});

var sendMessage = function(roomId, body) {
    var msgId = $.now();
    
    var url = host + "/_matrix/client/api/v1/rooms/$roomid/send/m.room.message?access_token=$token";
    url = url.replace("$token", accountInfo.access_token);
    url = url.replace("$roomid", encodeURIComponent(roomId));
    
    var data = {
        msgtype: "m.text",
        body: body
    };
    
    $.ajax({
        url: url,
        type: "POST",
        contentType: "application/json; charset=utf-8",
        data: JSON.stringify(data),
        dataType: "json",
        success: function(data) {
            $("#body").val("");
        },
        error: function(err) {
            alert(JSON.stringify($.parseJSON(err.responseText)));  
        }
    });
};

var setRooms = function(roomList) {
    $("#rooms").find("tr:gt(0)").remove();
    
    var rows = "";
    for (var i=0; i<roomList.length; ++i) {
        row = "<tr>" +
              "<td>"+roomList[i].room_id+"</td>" +
              "<td>"+roomList[i].membership+"</td>" +
              "<td>"+roomList[i].latest_message+"</td>" +
              "</tr>";  
        rows += row;
    }
    
    $("#rooms").append(rows);
    
    $('#rooms').find("tr").click(function(){
        var roomId = $(this).find('td:eq(0)').text();
        var membership = $(this).find('td:eq(1)').text();
        if (membership !== "join") {
            console.log("Joining room " + roomId); 
            var url = host + "/_matrix/client/api/v1/rooms/$roomid/join?access_token=$token";
            url = url.replace("$token", accountInfo.access_token);
            url = url.replace("$roomid", encodeURIComponent(roomId));
            $.ajax({
                url: url,
                type: "POST",
                contentType: "application/json; charset=utf-8",
                data: JSON.stringify({membership: "join"}),
                dataType: "json",
                success: function(data) {
                    loadRoomContent(roomId);
                    getCurrentRoomList();
                },
                error: function(err) {
                    alert(JSON.stringify($.parseJSON(err.responseText)));  
                }
            });
        }
        else {
            loadRoomContent(roomId);
        }
    });
};

var addMessage = function(data) {

    var msg = data.content.body;
    if (data.type === "m.room.member") {
        if (data.content.membership === undefined) {
            return;
        }
        if (data.content.membership === "invite") {
            msg = "<em>invited " + data.state_key + " to the room</em>";
        }
        else if (data.content.membership === "join") {
            msg = "<em>joined the room</em>";
        }
        else if (data.content.membership === "leave") {
            msg = "<em>left the room</em>";
        }
        else if (data.content.membership === "ban") {
            msg = "<em>was banned from the room</em>";
        }
    }
    if (msg === undefined) {
        return;
    }

    var row =   "<div class='message'>" +
                "<div class='userDiv'>" + data.user_id + "</div>" + 
                "<div class='msgDiv'>" + msg + "</div>" +
                "</div>";
    $("#messages").append(row);
};

var addMember = function(data) {
    var row = "<div class='memberBlock'>" +
              "<div class='memberState'>"+data.state_key+"</div>" +
              "<div class='memberMembership>"+data.content.membership+"</div>" +
              "</div>"; 
    $("#members").append(row);
};
