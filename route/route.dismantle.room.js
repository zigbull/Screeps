/**
 * Created by Piers on 15/08/2016.
 */
/**
 * @fileOverview Screeps module. Task move object.
 * @author Piers Shepperson
 */
"use strict";
var gc = require("gc");
var stats = require("stats");
var roleBase = require("role.base");
var raceBase = require("race.base");
var raceWorker = require("race.worker");
var raceSapper = require("race.sapper");
/**
 * Task move object. Used when we need to find the object to move to.
 * @module RouteDismantleRoom
 */

function RouteDismantleRoom (targetRoomName, move, work, heal, respawn, targetList) {
    this.type = gc.ROUTE_DISMANTLE_ROOM;
    this.targetRoomName = targetRoomName;
    this.move = move;
    this.work = work;
    this.heal = heal;
    this.respawn = respawn ? respawn : 0;
    this.targetList = targetList;
    this.due = 0;
}

RouteDismantleRoom.prototype.spawn = function (build, spawn) {
    //console.log("RouteMiner spawn", spawn, JSON.stringify(build));
    var body = raceSapper.body(build.move, build.work, build.heal);
    var name = stats.createCreep(spawn, body, undefined, undefined);
    if (_.isString(name)) {
        console.log("Spawning miner",name);
        roleBase.switchRoles(
            Game.creeps[name],
            gc.ROLE_DISMANTLE_ROOM,
            build.targetRoomName,
            build.targetList
        );
        Game.creeps[name].memory.buildReference = build.targetRoomName;
    }
    return name;
};

RouteDismantleRoom.prototype.energyCost = function(build) {
    return raceBase.energyFromBody(build.body);
};

RouteDismantleRoom.prototype.parts = function(build) {
    return build.body.length;
};

module.exports = RouteDismantleRoom;