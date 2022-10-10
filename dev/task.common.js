
var taskCommon = {

    //start with basics and add options later

    getClosestEnergySource(creep) {
        
        //first prize is structures to draw from
        var target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_EXTENSION ||
                    structure.structureType == STRUCTURE_SPAWN ||
                    structure.structureType == STRUCTURE_TOWER ||
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
    }
}

module.exports = taskCommon;