var roleRepairer = {

    /** @param {Creep} creep **/
    run: function(creep) {

        if(creep.memory.repairing && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.repairing = false;
            creep.say('🔄 source');
        }
        if(!creep.memory.repairing && creep.store.getFreeCapacity() == 0) {
            creep.memory.repairing = true;
            creep.say('⚡ repair');
        }

        if(creep.memory.repairing) {
            var target = Game.getObjectById(creep.memory.target);
            
            if(target)
                if((target.hits == target.hitsMax) ||
                    (target.hits > 10000000))
                    target = null;
            
            if(!target)
            {
                var targets = creep.room.find(FIND_STRUCTURES,{
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_ROAD ||
                            structure.structureType == STRUCTURE_WALL) &&
                            (structure.hits < structure.hitsMax) &&
                            structure.hitsMax < 10000000;
                    }
                });
                if( targets.length > 0) {
                    creep.memory.target = targets[0].id;
                    target = targets[0];
                }
            }
            if(creep.repair(target) == ERR_NOT_IN_RANGE) {
                creep.travelTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
            }
        }
        else {
            
            var source = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
            if(creep.pickup(source) == ERR_NOT_IN_RANGE) {
                creep.travelTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
            
            //default way, now replacing with dropped resource method
            /*
            var sources = creep.room.find(FIND_SOURCES);
            if(creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
                creep.travelTo(sources[0], {visualizePathStyle: {stroke: '#ffaa00'}});
            }
            */
        }
    }
};

module.exports = roleRepairer;