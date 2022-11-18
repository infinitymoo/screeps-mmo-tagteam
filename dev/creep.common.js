var taskCommon = require('task.common');
var u = require('util.common');

var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleTransport = require('role.transport');
var roleRepairer = require('role.repairer');
var roleAttacker = require('role.attacker');
var roleRefiller = require('role.refiller');
var roleClaimer = require('role.claimer');
var roleBreaker = require('role.breaker');
var roleSupplier = require('role.supplier');



var creepCommon = {

    cpuUsages: {},

    run() {

        this.cpuUsages = {
            upgrader:0,
            builder:0,
            repairer:0,
            harvester:0,
            transport:0,
            supplier:0,
            refiller:0,
            breaker:0
        };

        u.debug( Game.cpu.getUsed(), `pre-creep cpuUsage`);
    
        for(var name in Game.creeps) {
            var creep = Game.creeps[name];
    
            try {
                if(!creep.spawning) {
                    if(creep.memory.fleeing && creep.room.name != creep.memory.homeRoom) {
                        this.fleeRoom(creep);
                    }
                    else if (creep.memory.mode == "recycle") {

                        if(  creep.pos.x == 0 ||
                            creep.pos.x == 49 ||
                            creep.pos.y == 0 ||
                            creep.pos.y == 49 ) {
                                creep.Move(creep.room.controller.pos,{ignoreCreep:true,range:2});
                            }
                        else {

                            if( creep.room.name != creep.memory.homeRoom )
                                creep.Move(Game.rooms[creep.memory.homeRoom].controller.pos,{ignoreCreep:true,range:2});
                            else {                        
                                let closestSpawn = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, { filter: (structure) => { return structure.structureType == STRUCTURE_SPAWN }});
                                let result = closestSpawn.recycleCreep( creep );
                                if( result == ERR_NOT_IN_RANGE ) creep.Move( closestSpawn );
                            }
                        }
                    }
                    else {
                        if(creep.memory.role == 'upgrader') {
                            this.cpuMeasure(creep,roleUpgrader,'upgrader');
                            //roleUpgrader.run(creep);
                        }
                        if(creep.memory.role == 'builder') {
                            this.cpuMeasure(creep,roleBuilder,'builder');
                            //roleBuilder.run(creep);
                        }
                        if(creep.memory.role == 'repairer') {
                            this.cpuMeasure(creep,roleRepairer,'repairer');
                            //roleRepairer.run(creep);
                        }
                    
                        if(creep.memory.role == 'harvester') {
                            this.cpuMeasure(creep,roleHarvester,'harvester');
                            //roleHarvester.run(creep);
                        }
                        if(creep.memory.role == 'transport') {
                            this.cpuMeasure(creep,roleTransport,'transport');
                            // roleTransport.run(creep);
                        }
                        if(creep.memory.role == 'supplier') {
                            this.cpuMeasure(creep,roleSupplier,'supplier');
                            // roleSupplier.run(creep);
                        }
                        if(creep.memory.role == 'attacker') {
                            this.cpuMeasure(creep,roleAttacker,'attacker');
                            // roleAttacker.run(creep);
                        }
                        if(creep.memory.role == 'refiller') {
                            this.cpuMeasure(creep,roleRefiller,'refiller');
                            // roleRefiller.run(creep);
                        }
                        if(creep.memory.role == 'claimer') {
                            this.cpuMeasure(creep,roleClaimer,'claimer');
                            // roleClaimer.run(creep);
                        }
                        if(creep.memory.role == 'breaker') {
                            this.cpuMeasure(creep,roleBreaker,'breaker');
                            // roleBreaker.run(creep);
                        }
                    }
                }
            }
            catch( problem ) {
                console.log(`E creepCommon.run(): ${problem.name}: ${problem.message} ${problem.stack}`);
            }

        }

       u.debug(this.cpuUsages,'creep cpu usages');

       u.debug( Game.cpu.getUsed(), `post-creep cpuUsage`);

    },

    cpuMeasure: function(creep, func, measureKey) {
        let pre = Game.cpu.getUsed();
        func.run(creep);
        let post = Game.cpu.getUsed();
        this.cpuUsages[measureKey] += (post - pre);
    },

    fleeRoom: function(creep) {    

        if( Memory.intelDB && Memory.intelDB[creep.memory.fleeing] && ( Memory.intelDB[creep.memory.fleeing].activity.threatLevel == 0 ) ) {
            
            delete creep.memory.fleeing;
            return;
        }

        creep.Move(Game.rooms[creep.memory.homeRoom].controller.pos,{ignoreCreep:true,range:2});
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
        else if( !creep.memory.working && (!creep.memory.hasHarvested || creep.memory.hasHarvested <= 0) && creep.store[RESOURCE_ENERGY] != 0 ) {
            delete creep.memory.hasHarvested;
            creep.memory.working = true;
            creep.say('⚡'); 
        }
    },

    doUpgrade(creep) {
        taskCommon.upgradeController(creep);
    }

}

module.exports = creepCommon;