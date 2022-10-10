var taskCommon = require('task.common');

/* Summary Behaviour

** 1 - If upgrading behaviour state = true and energy is dry, switch to harvest mode by setting upgrading state = false
** 2 - Opposite of 1 for when upgrader is full
** 3 - Upgrader works from adjacent Link structure if there is one, so will transfer from base-side of link to its feeding link at controller if it can
** 4 - if its in upgrading state, run an upgrade work command
** 5 - otherwise if not doing #4, if no link saved in creep's memory to feed from, find link close to controller and set it up
** 6 - if upgrader link exists set up base link if its not set yet
** 7 - if upgrader link has more than 150 energy, draw from it or travel to it if out of range, and set to upgrade mode true if successful
** 8 - if can't use link method above, check if there's Storage structure and pick up from it
** 9 - if no Storage structure, pick up dropped energy off ground as last resort
*/

var roleUpgrader = {

    /** @param {Creep} creep **/
    run: function(creep) {
        try {
            // 1
            if(creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
                creep.memory.upgrading = false;
                creep.say('🔄 harvest');
            }
            // 2
            if(!creep.memory.upgrading && creep.store.getFreeCapacity() == 0) {
                creep.memory.upgrading = true;
                creep.say('⚡ upgrade');
            }
            //3
            let link = Game.getObjectById(creep.memory.link);
            let baseLink = Game.getObjectById(creep.room.memory.baseLink);
            if(link &&
                baseLink &&
                link.store.getUsedCapacity(RESOURCE_ENERGY) < 800 &&
                baseLink.store.getUsedCapacity(RESOURCE_ENERGY) > 0
                && baseLink.cooldown == 0) {
                baseLink.transferEnergy(link);
            }
            //4
            if(creep.memory.upgrading) {
                if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    creep.travelTo(creep.room.controller, {range:1});
                }
            }
            else {
                //5
                //if no link saved in creep's memory to feed from, find link close to controller and set it up
                if(!link) {
                    var links = creep.room.find(FIND_MY_STRUCTURES, {
                        filter: (structure) => {
                            return (structure.structureType == STRUCTURE_LINK)
                        }
                    });
                    if(links) {
                        _.forEach(links,(l) => {
                            if(creep.room.controller.pos.inRangeTo(l.pos,2)) {
                                creep.memory.link = l.id;
                                link = l;
                                //break; //TODO illegal break statement because lodash - must find another way to early return.
                            }
                        })
                    }
                }
                //6
                //if upgrader link exists set up base link if its not set yet
                if(link) {
                    //first ensure baseLink is set // TODO - this code doesn't make sense here, should be able to move it to start or initializer function
                    if(!creep.room.memory.baseLink) {
                        var links = creep.room.find(FIND_MY_STRUCTURES, {
                            filter: (structure) => {
                                return (structure.structureType == STRUCTURE_LINK &&
                                    structure.pos.inRangeTo(creep.room.storage.pos,3))
                            }
                        });
                        if(links[0]) {
                            creep.room.memory.baseLink = links[0].id;
                        }
                        else
                            throw "upgrader can't find baselink to set for room";
                    }
                    
                    //7
                    //if upgrader link has more than 150 energy, draw from it or travel to it if out of range, and set to upgrade mode true if successful
                    if(!link.store.getUsedCapacity(RESOURCE_ENERGY) < 150) {// TODO - set hardcoded 150 to actual upgrader capacity? or why limit at all?
                        var result = creep.withdraw(link,RESOURCE_ENERGY);
                        if(result == ERR_NOT_IN_RANGE) {
                            creep.travelTo(link, {ignoreCreeps: false,range:1});
                        }
                        if(result == OK) {
                            creep.memory.upgrading = true;
                        }
                        return; //have to do this otherwise storage retrieval code runs
                    }
                    //if the link didn't have enough storage, we want the next part to run to get energy from storage
                }
                //8
                //if there's storage
                if(creep.room.storage) {
                    var source = creep.room.storage;
                    
                    var result = creep.withdraw(source,RESOURCE_ENERGY);
                    
                    if(result == ERR_NOT_IN_RANGE) {
                        creep.travelTo(source, {ignoreCreeps: false,range:1});
                    }
                    return; //have to do this otherwise default code runs
                }
                //9
                //if no storage...
                if(!creep.room.storage) {

                    var source = taskCommon.getClosestEnergySource(creep);
                    var collectionMethod;

                    if(source instanceof Structure)
                        collectionMethod = "structure";
                    else
                        collectionMethod = "source";
                    
                    if(source) {                        
                        var result;
                        if(collectionMethod == "structure")
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
                        var harvestResult = creep.harvest(source);
                        if( harvestResult == ERR_NOT_IN_RANGE) {
                            creep.travelTo(source, {ignoreCreeps: false,range:1,maxRooms:1,reusePath:8});
                        }
                        if( harvestResult == OK ) { // TODO calc harvest count to fill dont hardcode
                            if(creep.memory.hasHarvested && creep.memory.hasHarvested > 0) {
                                creep.memory.hasHarvested--;
                            }
                            else
                                creep.memory.hasHarvested = 12;// assuming 2 work parts TODO make dynamic
                        }
                    }
                    return;
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
        catch (problem) {
            console.log('upgrader threw error: '+problem);
        }
    }
};

module.exports = roleUpgrader;