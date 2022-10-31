var taskCommon = require('task.common');

var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleTransport = require('role.transport');
var roleRepairer = require('role.repairer');
var roleAttacker = require('role.attacker');
var roleRefiller = require('role.refiller');
var roleClaimer = require('role.claimer');
var roleBreaker = require('role.breaker');

var creepCommon = {

    run() {
    
        for(var name in Game.creeps) {
            var creep = Game.creeps[name];
    
            try {
                if(!creep.spawning) {
                    if(creep.memory.fleeing) {
                        this.fleeRoom(creep);
                        return;
                    }
                    // if(creep.memory.class = 'worker') {
                    //     this.doJob(creep);                        
                    // }
                    if(creep.memory.role == 'upgrader') {
                        roleUpgrader.run(creep);
                    }
                    if(creep.memory.role == 'builder') {
                        roleBuilder.run(creep);
                    }
                    if(creep.memory.role == 'repairer') {
                        roleRepairer.run(creep);
                    }
                
                    if(creep.memory.role == 'harvester') {
                        roleHarvester.run(creep);
                    }
                    if(creep.memory.role == 'transport') {
                        roleTransport.run(creep);
                    }
                    if(creep.memory.role == 'attacker') {
                        roleAttacker.run(creep);
                    }
                    if(creep.memory.role == 'refiller') {
                        roleRefiller.run(creep);
                    }
                    if(creep.memory.role == 'claimer') {
                        roleClaimer.run(creep);
                    }
                    if(creep.memory.role == 'breaker') {
                        roleBreaker.run(creep);
                    }
                }
            }
            catch( problem ) {
                console.log(`E creepCommon.run(): ${problem.name}: ${problem.message} ${problem.stack}`);
            }

        }
    },

    fleeRoom: function(creep) {
    
        //if fleeing a room we were working in or in another threatened room while fleeing on the way to safety, go home
        if( creep.room.name == creep.memory.fleeing || Memory.rooms[creep.room.name].defending) {
            let homeController = Game.rooms[creep.memory.homeRoom].controller;
            creep.travelTo(homeController);
            return;
        }
        //we don't have to go all the way home, we can chill in a safe room next door
        else
            creep.travelTo(creep.room.controller);

        if( !Memory.rooms[creep.memory.fleeing].defending )
            delete creep.memory.fleeing;        
    },

    /**
     * Evaluates state of creep and determines if it should switch modes
     * @param {Creep} creep 
     */
    checkTransition: function(creep) {
        // if empty, switch to sourcing mode
        if(creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.working = false;
            creep.say('🧊');
        }
        // if it has energy, go work, unless its busy filling up with harvesting
        else if( !creep.memory.working && (!creep.memory.hasHarvested || creep.memory.hasHarvested == 0) && creep.store[RESOURCE_ENERGY] != 0 ){
            creep.memory.working = true;
            creep.say('⚡'); 
        }
    },

    doUpgrade(creep) {
        taskCommon.upgradeController(creep);
    }

}

var taskHarvest = function(creep,target) {
    return creep.harvest(target);
}

module.exports = creepCommon;