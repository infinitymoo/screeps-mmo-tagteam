var Traveler = require('Traveler');

var taskCommon = {

    run() {

    },

    getEnergy(creep) {
        var source = this.getClosestAvailableEnergy(creep);
        
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

    /**
     * To deprecate - Finds closest source of energy that is readily usable
     * @param {Creep} creep 
     * @param {Structure} cachedStructureTarget 
     * @param {Resource} cachedResourceTarget 
     * @returns 
     */
    getClosestAvailableEnergy(creep, cachedStructureTarget = false, cachedResourceTarget = false) {
        //initialize the data
        let structureTarget = cachedStructureTarget;
        let resourceTarget = cachedResourceTarget;

        if(!cachedStructureTarget) {
            structureTarget = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (
                        structure.structureType == STRUCTURE_STORAGE ||
                        structure.structureType == STRUCTURE_CONTAINER ||
                        structure.structureType == STRUCTURE_LINK) &&
                        structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
                }
            });
        }
        
        if(!cachedResourceTarget) {
            resourceTarget = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
                filter: (resource) => {
                    return resource.resourceType == RESOURCE_ENERGY;
                }
            });
        }

        //validate and return early if target assigned
        let target = false;
        if( !resourceTarget && structureTarget)
            target = structureTarget;
        if ( !structureTarget && resourceTarget )
            target = resourceTarget;

        if( !target && structureTarget && (creep.pos.getRangeTo(structureTarget) < creep.pos.getRangeTo(resourceTarget) ))
            target = structureTarget;

        if( !target && resourceTarget)
            target = resourceTarget;

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
    },
    
    harvestResource() {
        
        if(creep.store.getFreeCapacity() > 0) {
            var source = Game.getObjectById(creep.memory.source);
            var wasRemoteRoom = false; // to check for blindness, not remoteness
            
            //if we can't see the source it might be because we don't have vision
            if(!source) {                
                _.forEach( Memory.rooms[creep.memory.homeRoom].remoteSources, (remoteSource) => {
                    if(remoteSource.id == creep.memory.source) {
                        var source = Game.getObjectById(creep.memory.source);
                        if( source )
                            creep.travelTo(new RoomPosition(source.pos.x,source.pos.y,remoteSource.room));
                        else
                            creep.travelTo(new RoomPosition(remoteSource.x,remoteSource.y,remoteSource.room)); // TODO - I think it can't see pos.x etc if no vision and this is backup, but can save with state machine
                        wasRemoteRoom = true;
                    }
                })

                if( !wasRemoteRoom ) {
                    var sources = creep.room.find(FIND_SOURCES);
                    source = sources[1];
                    if (!source) {
                        source = sources[0];
                    }
                    creep.memory.source = source.id;
                }
            }
            
            if( !wasRemoteRoom ) {
                var result = creep.harvest(source);
                if(result == ERR_NOT_IN_RANGE) {
                    creep.travelTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
                }
                else if(result == OK) {

                    if( !creep.memory.baseRange ) {
                        creep.memory.baseRange = this.getBaseRange(creep);
                        creep.memory.transportCoverage = this.getTransportCoverage(creep);
                    }
                }
            }
            
        }
    }
}



//All selectors must return falsey if unsuccessful and truey if successful
var taskSelector = {    



    /**
     * Finds closest source of energy that is readily usable
     * @param {Creep} creep 
     * @param {Structure} cachedStructureTarget 
     * @param {Resource} cachedResourceTarget 
     * @returns 
     */
     selectClosestAvailableEnergy(creep, cachedStructureTarget = false, cachedResourceTarget = false) {
    },
}

module.exports = taskCommon;