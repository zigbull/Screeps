/**
 * @fileOverview Screeps module. Abstract object for handling the foreign 
 * harvest policy. 
 * @author Piers Shepperson
 */
var _ = require('lodash');
var raceWorker = require("race.worker");
var PoolRequisition = require("pool.requisition");
var gc = require("gc");
var roleNeutralBuilder = require("role.neutral.harvester");

/**
 * Abstract object to support the policy of minig a source in an unoccumpied 
 * room
 * @module policyForeignHarvest
 */
var policyForeignHarvest = {

    initialisePolicy: function (newPolicy) {
        var body =  raceWorker.body(newPolicy.workerSize, true);
        var taskList = roleNeutralBuilder.getTaskList(
            newPolicy.harvestRoom,
            newPolicy.storageRoom,
            newPolicy.sourceId,
            newPolicy.offLoadId);
        console.log("policyNeutralBuilder newPolicy.buildRoomy", newPolicy.buildRoom, newPolicy.sourceRoom)

        var order = new PoolRequisition(
            newPolicy.id
            , body
            , taskList
            , undefined
            , undefined
        );
        console.log("initialisePolicy policyForeignHarvest", JSON.stringify(order));
        PoolRequisition.prototype.placeRequisition(order);
    },
    
    draftNewPolicyId: function(currentPolicy)
    {
       return null;
       // return currentPolicy;
    },

    cleanUp: function(oldPolicy)
    {
      /*  var creeps = _.filter(Game.creeps, function (creep) {
            return creep.memory.policyId == oldPolicy.id
        });
        for ( var i = 0 ;  i < creeps.length ; i++ ) {
            PoolRequisition.prototype.returnToPool(creeps[i].name);
        }*/
    },

    switchPolicy: function(oldPolicy, newPolicy)
    {
    },

    enactPolicy: function(currentPolicy) {
    }

}

module.exports = policyForeignHarvest;