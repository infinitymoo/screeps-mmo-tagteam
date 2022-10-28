/** Limitations to address asap
 * 1 homeRoom attribute management
 * 2 Dependence on Storage structure - why not behave like transport if no Storage?
 * 3 modularize behaviours as much is shared with transport role
 */

 var roleRefiller = {

    /** @param {Creep} creep **/
    run: function(creep) {

        this.checkTransition(creep);
        
        //optimization for if i'm close to it, even while running drop-off
        var source = creep.room.storage;
        if( source ) {
            let result = creep.withdraw(source,RESOURCE_ENERGY);
        }

        if(creep.memory.mode && creep.memory.mode == "static") {

            if(!creep.memory.position) {
                throw ("Exception thrown: role.refiller is static but no position specified");
            }

            // TO DO ******************************************************************************

            //if in position 
            var staticPosition = new RoomPosition(creep.memory.position.x, creep.memory.position.y, creep.memory.homeRoom);
            if(creep.pos.x == staticPosition.x && creep.pos.y == staticPosition.y) {
                //ensure we know our flows
                if( !creep.memory.sourceStructures ) {
                    var sources = creep.room.find(FIND_STRUCTURES, {
                        filter: (structure) => {
                            return (structure.structureType == STRUCTURE_CONTAINER ||
                                structure.structureType == STRUCTURE_STORAGE) &&
                                creep.pos.isNearTo(structure);
                        }
                    });
                }
                if( !creep.memory.targetStructures ) {
                    var targets = creep.room.find(FIND_STRUCTURES, {
                        filter: (structure) => {
                            return (structure.structureType == STRUCTURE_EXTENSION ||
                                structure.structureType == STRUCTURE_SPAWN ||
                                (structure.structureType == STRUCTURE_LINK && Game.rooms[creep.room.name].memory.baseLink == structure.id) || // only target link if its baselink
                                structure.structureType == STRUCTURE_TOWER) &&
                                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 5;//avoid link transfer cost leaving 1 energy gaps to call for refilling
                        }
                    });
                }
                //execute flows
            }
            //if not in position, get there first
            else {
                creep.travelTo( staticPosition );
            }

        }
        else {
            // 3
            if(creep.memory.transport) {
                var target = false;
                var result;
                
                if(creep.memory.targetLock) {
                    var targetLock = Game.getObjectById(creep.memory.targetLock);
                    if(targetLock.store.getFreeCapacity(RESOURCE_ENERGY) > 5) {//avoid link transfer cost leaving 1 energy gaps to call for refilling
                        target = targetLock;
                    }
                    else {
                        delete creep.memory.targetLock;
                    }
                }
                
                //we want a list of things to refill on our way to our targetlock for efficiency purposes
                //TODO read from cache not refind everything
                var targets = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_EXTENSION ||
                            structure.structureType == STRUCTURE_SPAWN ||
                            (structure.structureType == STRUCTURE_LINK && Game.rooms[creep.room.name].memory.baseLink == structure.id) || // only target link if its baselink
                            structure.structureType == STRUCTURE_TOWER) &&
                            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 5;//avoid link transfer cost leaving 1 energy gaps to call for refilling
                    }
                });
                
                if(targets.length > 1) {
                    for(var i=1;i<targets.length;i++) {
                        if(creep.pos.isNearTo(targets[i])) {
                            result = creep.transfer(targets[i], RESOURCE_ENERGY);
                            break;
                        }
                    }
                }

                //above might empty it, so lets check and refuel if so.
                this.checkTransition(creep);
                if( !creep.memory.transport )
                    this.getSource(creep);
                
                
                //don't have targetLock with free capacity
                if(!target) {
                    this.getNewRefillTarget(creep,targets);
                    target = Game.getObjectById(creep.memory.targetLock);
                }
                
                //if we're passing something that can be filled on our way to our targetLock, fill it
                if(target) {
                    
                    if( creep.pos.isNearTo(target) && (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) ) {      
                        result = creep.transfer(target, RESOURCE_ENERGY);
                    }
                    
                    //transferred some energy but still not at target
                    if( !creep.pos.isNearTo(target) && (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) ) {                            
                        creep.travelTo(target, {ignoreCreeps: false,range:1,reusePath:10});
                        return;
                    }

                    //if we reached our target and transferred successfully, release targetLock
                    if(result == OK && creep.pos.isNearTo(target)) {
                        delete creep.memory.targetLock;
                        this.getNewRefillTarget(creep,targets);
                        target = Game.getObjectById(creep.memory.targetLock);
                        if( !creep.pos.isNearTo(target) && (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) ) {                            
                            creep.travelTo(target, {ignoreCreeps: false,range:1,reusePath:10});
                            return;
                        }
                        return;
                    }                    
                }

                //if reached original target and transferred, baseLink is next target for now
                if(creep.memory.homeRoom && 
                    Memory.rooms[creep.memory.homeRoom].baseLink && 
                    Game.getObjectById(Memory.rooms[creep.room.name].baseLink).store.getFreeCapacity(RESOURCE_ENERGY) > 5) {//avoid link transfer cost leaving 1 energy gaps to call for refilling
                        
                    var baseLink = Game.getObjectById(Memory.rooms[creep.room.name].baseLink);
                    target = baseLink;
                    creep.memory.targetLock = baseLink.id;
                }

                
            }
            //TODO what if there's no storage? need to have fallback behaviour.
            //pickup mode
            else {
                this.getSource(creep);
            }
        }
    },

    /**
     * Evaluates state of creep and determines if it should switch modes
     * @param {Creep} creep 
     */
    checkTransition: function(creep) {        
        // if empty, switch to sourcing mode
        if(creep.memory.transport && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.transport = false;
            creep.say('🧊');
        }
        // if has energy and was in sourcing mode, go refill
        else if(!creep.memory.transport && creep.store[RESOURCE_ENERGY] != 0 ) {
            creep.memory.transport = true;
            creep.say('🍺'); 
        }
    },

    /**
     * Takes from a source or travels to it
     * @param {Creep} creep 
     */
    getSource: function(creep) {
        var source = creep.room.storage;
        if( source ) {
            var result = creep.withdraw(source,RESOURCE_ENERGY);
            if( result == ERR_NOT_IN_RANGE) {
                creep.travelTo(source, {ignoreCreeps: false,range:1,reusePath:10});
            }
        }
    },

    /** Sets new creep memory targetLock */
    getNewRefillTarget: function(creep,cachedTargets) {
            
        var targets;
        if(cachedTargets) {
            targets = cachedTargets;
        }
        else {
            //we want a list of things to refill on our way to our targetlock for efficiency purposes
            targets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_EXTENSION ||
                        structure.structureType == STRUCTURE_SPAWN ||
                        (structure.structureType == STRUCTURE_LINK && Game.rooms[creep.room.name].memory.baseLink == structure.id) || // only target link if its baselink
                        structure.structureType == STRUCTURE_TOWER) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 5;//avoid link transfer cost leaving 1 energy gaps to call for refilling
                }
            });
        }

        if(targets[0]) {
            var target = targets[0];
            creep.memory.targetLock = target.id;
        }        
    }
};

module.exports = roleRefiller;