var Traveler = require('Traveler');

var taskCommon = {

    run() {

    },

    getEnergy(creep) {
        var source = this.getClosestEnergy(creep);
        
        if(source) {                        
            var result;
            if(source instanceof Structure)
                result = creep.withdraw(source,RESOURCE_ENERGY);
            else
                result = creep.pickup(source);
            
            if(result == ERR_NOT_IN_RANGE) {
                creep.travelTo(source,{ignoreCreeps: false,range:1,maxRooms:1,reusePath:8});
            }
            return;
        }
        else {
            source = creep.pos.findClosestByRange(FIND_SOURCES);
            if(source) {
                var harvestResult = creep.harvest(source);
                if( harvestResult == ERR_NOT_IN_RANGE) {
                    creep.travelTo(source, {ignoreCreeps: false,range:1,maxRooms:1,reusePath:8});
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
    },

    getClosestEnergy(creep) {
        
        //first prize is structures to draw from
        var target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (structure) => {
                return (
                    structure.structureType == STRUCTURE_STORAGE ||
                    structure.structureType == STRUCTURE_CONTAINER ||
                    structure.structureType == STRUCTURE_LINK) &&
                    structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
            }
        });

        if(target) {
            return target;
        }
        
        //no structures, maybe dropped resources are available
        target = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES); 

        if(target) {
            return target;
        }

        //nothing found
        return false;
    },

    //TODO workstation logic to implement here
    upgradeController(creep) {        
        if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
            creep.travelTo(creep.room.controller, {range:1});
        }
    }

}

module.exports = taskCommon;