var taskCommon = require('task.common');

var roleUpgrader = {

    /** @param {Creep} creep **/
    run: function(creep) {
        try {
            this.checkTransition(creep);

            if(creep.memory.working) {

                // if(!creep.pos.isNearTo(creep.room.controller))
                //     creep.Move(creep.room.controller, {range:1});

                let result = creep.upgradeController(creep.room.controller);
                if( result == ERR_NOT_IN_RANGE ) {
                    creep.Move(creep.room.controller, {range:3});
                }
            }
            else {
                if(Memory.rooms[creep.room.name] && Memory.rooms[creep.room.name].links && Memory.rooms[creep.room.name].links.controllerLink) {
                    let controllerLink = Game.getObjectById(Memory.rooms[creep.room.name].links.controllerLink);
                    var result = creep.withdraw(controllerLink,RESOURCE_ENERGY);
                    if(result == ERR_NOT_IN_RANGE) {
                        creep.Move(controllerLink, {ignoreCreeps: false,range:1});
                    }
                    if(result == OK) {
                        creep.memory.working = true;
                    }
                    //return; //have to do this otherwise storage retrieval code runs
                }
            
                this.getEnergy(creep);
                return;
                
            }
        }
        catch (problem) {
            console.log('upgrader threw error: '+problem);
        }
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
            delete creep.memory.hasHarvested;
            creep.memory.working = true;
            creep.say('⚡'); 
        }
    },

    getEnergy(creep) {
        var source = taskCommon.getClosestAvailableEnergy(creep);
        
        if(source) {                        
            var result;
            if(source instanceof Structure)
                result = creep.withdraw(source,RESOURCE_ENERGY);
            else
                result = creep.pickup(source);
            
            if(result == ERR_NOT_IN_RANGE) {
                creep.Move(source,{ignoreCreeps: false,range:1,maxRooms:1,reusePath:8});
            }
            return;
        }
        else {
            source = creep.pos.findClosestByRange(FIND_SOURCES);
            if(source) {
                var harvestResult = creep.harvest(source);
                if( harvestResult == ERR_NOT_IN_RANGE) {
                    creep.Move(source, {ignoreCreeps: false,range:1,maxRooms:1,reusePath:8});
                }
                if( harvestResult == OK ) {
                    creep.memory.hasHarvested = creep.store.getFreeCapacity(RESOURCE_ENERGY);
                    if( creep.memory.hasHarvested == 0)
                        delete creep.memory.hasHarvested;
                }
            }
            else if( creep.store.getUsedCapacity() > 0 ) {
                creep.memory.working = true;
            }
        }
    }
};

module.exports = roleUpgrader;