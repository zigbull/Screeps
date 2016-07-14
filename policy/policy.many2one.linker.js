/**
 * Created by Piers on 08/07/2016.
 */
/**
 * @fileOverview Screeps module. Set up linkers.
 * @author Piers Shepperson
 */
"use strict";
var policyFrameworks = require("policy.frameworks");
var policyRescue = require("policy.rescue");
var policy = require("policy");
var stats = require("stats");
var policyConstruction = require("policy.construction");
var policyDefence = require("policy.defence");
var policyFrameworks = require("policy.frameworks");
var raceBase = require("race.base");
var raceWorker = require("race.worker");
var roomOwned = require("room.owned");
var _ = require('lodash');
var policyBuildspawn = require("policy.buildspawn");
var roleBase = require("role.base");
var poolSupply = require("pool.supply");
var gc = require("gc");
var roleLinkerSource = require("role.linker.source");
var roleLinkerMinerStorage = require("role.linker.miner.storage");
var tasks = require("tasks");
var roleEnergyPorter = require("role.energy.porter");
var npcInvaderBattle = require("npc.invader.battle");
var roleStorageRepairer = require("role.storage.repairer");
var policySupply = require("pool.supply");
/**
 * Abstract Policy
 * @module policyMany2oneLinker
 */
var policyMany2oneLinker = {
    NUMBER_OF_LINKERS:  3,
    REPAIRER_THREASHOLD:  5,

    initialisePolicy: function (newPolicy) {
        console.log("initialisePolicy policyMany2oneLinker");
        var room = Game.rooms[newPolicy.room];

        var fromLinks = newPolicy.fromLinks;
        var toLink = newPolicy.toLink;
        room.memory.links.fromLinks = fromLinks;
        room.memory.links.toLink = toLink;
        room.memory.links.linkCreeps = undefined;
        if (undefined === room.memory.links.linkCreeps) {
            room.memory.links.linkCreeps = [];
            room.memory.links.linkCreeps.push({creepName: undefined, role : gc.ROLE_LINKER_SOURCE,
                linkInfo: fromLinks[0], toInfo: toLink});
            room.memory.links.linkCreeps.push({creepName: undefined, role : gc.ROLE_LINKER_SOURCE,
                linkInfo: fromLinks[1], toInfo: toLink});
            room.memory.links.linkCreeps.push({creepName: undefined, role : gc.ROLE_LINKER_MINER_STORAGE,
                linkInfo: toLink});
        }

        return true;
    },

    draftNewPolicyId: function(oldPolicy) {
        var room = Game.rooms[oldPolicy.room];
        if (policyRescue.needsRescue(room)) {
            return policyFrameworks.createRescuePolicy(room.name);
        }
        var creeps = _.filter(Game.creeps, function (creep)
        {return creep.memory.policyId == oldPolicy.id});
        if (3 >= creeps.length) {
            console.log("CHANGE POLICY Not enough creeps to maintain all links", creeps.length)
            return  policyFrameworks.createPeacePolicy(room.name);
        }

        var linkStructures = room.find(FIND_STRUCTURES, {
            filter: function(structure) {
                return (structure.structureType == STRUCTURE_LINK ||
                structure.structureType == STRUCTURE_STORAGE )
            }
        });
        if (4 < linkStructures.length) {
            console.log("CHANGE POLICY Less then thee links and one storage ")
            return  policyFrameworks.createPeacePolicy(room.name);
        }
        return oldPolicy;
    },

    readyForMAny2OneLinker: function (OldPolicy) {
        var room = Game.rooms[OldPolicy.room];
        if ( (room.memory.linkState == "linkEconomy" || room.memory.linkState == "linkForming")
            && (policy.creepLifeTicks(OldPolicy) > gc.MANY2ONE_REQUIRED_LIFE) ) {
            return true;
        }
        return false;
    },

    switchPolicy: function(oldPolicy, newPolicy)
    {
        switch(oldPolicy.type) {
            case policyFrameworks.Type.RESCUE:
                break;
            case policyFrameworks.Type.CONSTRUCTION:
                break;
            case policyFrameworks.Type.DEFEND:
                break;
            case policyFrameworks.Type.PEACE:
            default:
        }
        policy.reassignCreeps(oldPolicy, newPolicy);
    },

    enactPolicy: function(currentPolicy) {
        var room = Game.rooms[currentPolicy.room];
        // console.log("ENACT POLICY MANY2ONE LINKERS",room);//,"contruction left",roomOwned.getConstructionLeft(room));
        poolSupply.updateSupplyLevel(room.name
            ,roomOwned.calaculateSuplly(room)
            ,room.energyCapacityAvailable);

        //this.initialisePolicy(currentPolicy);
      //  if (!this.checkCreepsStillAlive(currentPolicy, this.NUMBER_OF_LINKERS)) {
      //      console.log("checkCreepsStillAlive gave false aboutto findNewLinkers");
      //      this.findNewLinkers(currentPolicy);
      //  }
        if (!this.checkCreepsStillAlive(currentPolicy, this.NUMBER_OF_LINKERS)) {
            console.log("replacing dead porter");
            this.spawnLinkerCreep(spawns, currentPolicy);
            this.findNewLinkers(currentPolicy);
        }


        this.checkRoles(room, currentPolicy);
        var spawns = room.find(FIND_MY_SPAWNS);
        console.log("extraPorters", this.extraPorters(room), " < porterShortfall"
            , this.porterShortfall(room,currentPolicy));
        var externalCommitments = poolSupply.getEnergyInBuildQueue(room.name);
        console.log("Many2one about to look into spawning, external commitmnets", externalCommitments);
        if ( this.extraPorters(room) < this.porterShortfall(room,currentPolicy)) {
            console.log("tryingToSpawn extraPorters",this.extraPorters(room)
                ,"shortfall", this.porterShortfall(room,currentPolicy) );
            var body = raceWorker.body(this.porterSize(room));
            var name = stats.createCreep(spawns[0], body, undefined, currentPolicy.id);
            if(_.isString(name)) {
                console.log("spawning porter");
                this.convertPorter(Game.creeps[name, currentPolicy]);
            }

        } else if (externalCommitments) {
            var build = poolSupply.nextRequisition(room.name);
            console.log(room,"about to build ", build.energy);
            var buildName = stats.createCreep(spawns[0], build.body, undefined, currentPolicy.id);
            if(_.isString(buildName)) {
                console.log(room,"Built contract creep energy cost", build.energy);
                policySupply.completedOrder(room.name, build, buildName);
            }
        }

        npcInvaderBattle.defendRoom(room);
    },

    checkRoles: function (room, currentPolicy) {
        var creeps = _.filter(Game.creeps, function (creep) {
            return creep.memory.policyId == currentPolicy.id})
        var fromLinker1 = room.memory.links.linkCreeps[0].creepName;
        var fromLinker2 = room.memory.links.linkCreeps[1].creepName;
        var toLinker = room.memory.links.linkCreeps[2].creepName;
        for (var i = 0 ; i < creeps.length ; i++ ) {
            //   console.log(room,"in checkRoles",creeps[i],"role",creeps[i].memory.role);
            if ( creeps[i].memory.role == gc.ROLE_LINKER_SOURCE) {
                if (creeps[i].name !=  fromLinker1 && creeps[i].name !=  fromLinker2) {
                    //         console.log(room,"iconverting",creeps[i],"to porter");
                    this.convertPorter(creeps[i], currentPolicy);
                } else {
                    //  console.log(room,"found linker",creeps[i])
                }
            } else  if ( creeps[i].memory.role == gc.ROLE_LINKER_MINER_STORAGE) {
                if (creeps[i].name !=  toLinker) {
                    //     console.log(room,"iconverting",creeps[i],"to porter");
                    this.convertPorter(creeps[i], currentPolicy);
                } else {
                    //  console.log(room,"found linker",creeps[i])
                }
            } else if ( creeps[i].memory.role != gc.ROLE_FLEXI_STORAGE_PORTER
                && creeps[i].memory.role != gc.ROLE_STORAGE_REPAIRER ) {
                //     console.log(room,"iconverting",creeps[i],"to porter");
                this.convertPorter(creeps[i], currentPolicy);
            }
        }
    },

    porterSize: function (room) {
        return Math.min(gc.LINKING_WORKER_SIZE, raceWorker.maxSizeRoom(room));
    },

    extraPorters: function (room) {
        var storage = room.find(FIND_STRUCTURES, {
            filter: { structureType : STRUCTURE_STORAGE }
        })
        if (storage[0].store[RESOURCE_ENERGY] > 10000) {
            // console.log("porter size",this.porterSize(room))
            return this.porterSize(room);
        } else {
            return 0;
        }
    },


    porterShortfall: function (room,currentPolicy) {
        var energyCost = 0;
        var porters = _.filter(Game.creeps, function (creep) {
            return (creep.memory.policyId == currentPolicy.id
            &&  creep.memory.role == gc.ROLE_FLEXI_STORAGE_PORTER );
        })
        for (var i in porters) {
            var energyI = raceBase.getEnergyFromBody(porters[i].body);
            energyCost = energyCost + energyI;
            //   console.log(porters[i],"cost", energyI,"body", porters[i]);
        }

        var porterSize = Math.min(5, raceWorker.maxSizeRoom(room));
        var existingPorterParts = energyCost / 200;
        var externalCommitments = poolSupply.getEnergyInBuildQueue();


        var portersNoCommitmentsEnergyLT = roomOwned.energyLifeTime(room, 1,  gc.ROLE_FLEXI_STORAGE_PORTER);

        var sourceEnergyLT  = roomOwned.allSourcesEnergy(room) *5;
        var energyBuildLinkersAndRepairer = 4*1000;

        var energyForUpgrading = sourceEnergyLT - energyBuildLinkersAndRepairer - externalCommitments;
        var numPortersPartsNeeded = Math.max(5,energyForUpgrading / portersNoCommitmentsEnergyLT);
        var porterShortfall = numPortersPartsNeeded - existingPorterParts;//*policy.creepsAgeFactor(currentPolicy);

        // console.log("porterSize",porterSize,"existingPorterParts",existingPorterParts
        //  ,"externalCommitments",externalCommitments);
        //  console.log("portersNoCommitmentsEnergyLT",portersNoCommitmentsEnergyLT,"sourceEnergyLT",sourceEnergyLT
        //   ,"energyBuildLinkersAndRepairer",energyBuildLinkersAndRepairer);
        //   console.log("energyForUpgrading",energyForUpgrading,"numPortersPartsNeeded",numPortersPartsNeeded,
        //   "porterShortfall",porterShortfall);
        //  console.log(room,"porterShortfall",porterShortfall,"needed",numPortersPartsNeeded,"existing"
        //            ,existingPorterParts,"age factor",policy.creepsAgeFactor(currentPolicy));
        return porterShortfall;
    },

    convertPorter: function(creep,currentPolicy ) {
        //   console.log("in converporter",creep);
        if (undefined !== creep) {
            var creeps = _.filter(Game.creeps, function (creep) {
                return creep.memory.policyId == currentPolicy.id
            });
            var foundRepaier = false;
            if ( creeps.length > this.REPAIRER_THREASHOLD ) {
                foundRepaier = false;
                var i = 0;
                while (i < creeps.length && !foundRepaier) {
                    //    console.log("convertPorter while loop i",i,"lenght",creeps.length);
                    if ( creeps[i].memory.role == gc.ROLE_STORAGE_REPAIRER ) {
                        foundRepaier = true;
                    }
                    i++;
                }
            }
            if (foundRepaier || creeps.length <= this.REPAIRER_THREASHOLD ) {
                roleBase.switchRoles(creep, gc.ROLE_FLEXI_STORAGE_PORTER);
               // roleBase.switchRoles(creep, gc.ROLE_FLEXI_STORAGE_PORTER);
                // creep.memory.role = gc.ROLE_ENERGY_PORTER;
                // if (undefined === creep.memory.tasks)
                //     creep.memory.tasks = {};
                //// creep.memory.tasks.tasklist = roleEnergyPorter.moveTaskList(creep);
                //   console.log("New Energy Porter tsetlisg", JSON.stringify(creep.memory.tasks.tasklist) );
                //tasks.setTargetId(creep,undefined);
            } else {
                roleBase.switchRoles(creep, gc.ROLE_STORAGE_REPAIRER);
                //this.convertStorageRepairer(creep);
            }
        }
    },

    spawnLinkerCreep: function (spawn, currentPolicy) {
        var body = raceWorker.body(gc.LINKING_WORKER_SIZE);
        var room = Game.rooms[currentPolicy.room];
        var spawns = room.find(FIND_MY_SPAWNS);

        //var name = spawns[0].createCreep( body, undefined);//, currentPolicy.id);
        var name = spawns[0].createCreep(body, name, {policyId: currentPolicy.id});
        if (_.isString(name)) {
            var linkCreeps = room.memory.links.linkCreeps;
            for ( var i = 0 ; i < linkCreeps.length ; i++ )
            {
                if (undefined === linkCreeps[i]) {
                    linkCreeps[i].creepName = name;
                    if (linkCreeps[i].linkInfo.fromId !== undefined) {
                        this.makeFromLinker(Game.creeps[name]
                            ,linkCreep[i].linkInfo
                            , linkCreep[i].toLink);
                    } else {
                        this.makeToLinker(Game.creeps[name], linkCreep[i].linkInfo);
                    }
                    console.log(name,"New linker spawned");
                }
            }
        }
        return name;
    },

    findNewLinkers: function (currentPolicy) {
        //   console.log("In findNewLiners loop counter");
        var room = Game.rooms[currentPolicy.room];
        var linkCreeps = room.memory.links.linkCreeps;
        var fromLinks = room.memory.links.fromLinks;
        var toLink = room.memory.links.toLink;
        var creeps = _.filter(Game.creeps, function (creep) {return creep.memory.policyId == currentPolicy.id});
        for (var i = creeps.length-1 ; i >=0 ; i-- ) {
           //  console.log(creeps[i].name,"In findNewLiners loop counter",i)
           // console.log(creeps[i],"energy ",raceBase.getEnergyFromBody(creeps[i].body), "divided by block size",
           //     raceBase.getEnergyFromBody(creeps[i].body)/gc.BLOCKSIZE_COST_WORKER, "blocksize",gc.BLOCKSIZE_COST_WORKER);

            if ( ( gc.ROLE_LINKER_SOURCE != creeps[i].memory.role
                && gc.ROLE_LINKER_MINER_STORAGE != creeps[i].memory.role)
                && this.bodySuitableForLinker(creeps[i])
            )
            {
            //    console.log("linkCreeps[0].creepName",linkCreeps[0].creepName,this.doesLinkerExist(room,0),"linkCreeps[1].creepName"
           //         ,linkCreeps[1].creepName,this.doesLinkerExist(room,1),"linkCreeps[2].creepName"
           //         ,linkCreeps[2].creepName,this.doesLinkerExist(room,2));

                //  if (linkCreeps)
                if (!this.doesLinkerExist(room,0) ) {
                    console.log("in 0 ");
                    linkCreeps[0].creepName = creeps[i].name;
                    this.makeFromLinker(creeps[i] ,fromLinks[0], toLink);
                } else  if (!this.doesLinkerExist(room,1)) {
                    console.log("in 1 ");
                    linkCreeps[1].creepName = creeps[i].name;
                    this.makeFromLinker(creeps[i] ,fromLinks[1], toLink);

                } else {
                    if (!this.doesLinkerExist(room,2)) {
                        console.log("in 2 ");
                        linkCreeps[2].creepName = creeps[i].name;
                        this.makeToLinker(creeps[i], toLink);
                    }
                }

            }  // harvester
        }//for
    },

    bodySuitableForLinker: function (creep) {
        return raceBase.isCreep(creep, "worker", gc.LINKING_WORKER_SIZE);
    },

    checkCreepsStillAlive: function (currentPolicy, numberOfLinkers) {
        var room = Game.rooms[currentPolicy.room];
        if (undefined === room.memory.links.linkCreeps) {
            return false;
        }
        var numLinkersFound = 0;
        var linkCreeps = room.memory.links.linkCreeps;
        if (numberOfLinkers != linkCreeps.length){
            return false;
        }
        for ( var i = 0 ; i < linkCreeps.length ; i++ )
        {
           if (!this.doesLinkerExist(room,i)) {
               return false;
           }
        }
        return true;
    },

    doesLinkerExist: function (room,index) {
        var linkCreeps = room.memory.links.linkCreeps;
        if (undefined === linkCreeps[index]) {
         //   console.log(index,"doesLinkerExist no link ");
            return false;
        }
        if (undefined == linkCreeps[index].creepName){
         //   console.log(index,"doesLinkerExist no creep name in link data ");
            return false;
        }
        if (undefined === Game.creeps[linkCreeps[index].creepName]) {
           // console.log(index,"doesLinkerExist no creep in game "); <<<<<<<<<<<
            return false;
        }
        if (Game.creeps[linkCreeps[index].creepName].memory.role != linkCreeps[index].role){
           //  console.log(index,"doesLinkerExist creep has wrong role");
            return false;
        }
        return true;
    },

    makeFromLinker: function (creep, fromLink, toLink) {
        if (undefined === creep.memory.tasks)
            creep.memory.tasks = {};
        // moveTaskList: function(creep, x,y,sourceId, homeLinkId, targetLinkId)
        creep.memory.tasks.tasklist = roleLinkerSource.getTaskList(creep,fromLink.x, fromLink.y
            , fromLink.fromId, fromLink.fromLinkId, toLink.toLinkId );
        creep.memory.role = gc.ROLE_LINKER_SOURCE;
        tasks.setTargetId(creep,undefined);
    },

    makeToLinker: function (creep, toLink) {
        if (undefined === creep.memory.tasks)
            creep.memory.tasks = {};
        creep.memory.tasks.tasklist = roleLinkerMinerStorage.getTaskList(creep, toLink.x, toLink.y
            , toLink.storageId, toLink.toLinkId , toLink.mineId, toLink.mineResource );
        creep.memory.role = gc.ROLE_LINKER_MINER_STORAGE;
        tasks.setTargetId(creep,undefined);
    },

};




module.exports = policyMany2oneLinker;






































