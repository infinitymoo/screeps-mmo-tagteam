var u = require('util.common');

/** Limitations to address asap
 * 1 homeRoom attribute management
 * 2 Dependence on Storage structure - why not behave like transport if no Storage?
 * 3 modularize behaviours as much is shared with transport role
 */

 var roleRefiller = {

    /** @param {Creep} creep **/
    run: function(creep) {

        this.checkTransition(creep);
        let result;
        let source;
        
        //optimization for if i'm close to it, even while running drop-off
        if(creep.room.storage)
            source = creep.room.storage;
        else {
            source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (structure) => {
                    return ( structure.structureType == STRUCTURE_CONTAINER ) &&
                        structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
                }
            });
        }

        if( source && !creep.memory.dropOffOveride && creep.memory.targetLock ) {
            result = creep.withdraw(source,RESOURCE_ENERGY);
        }
        else if( source && creep.memory.dropOffOveride) {
            result = creep.transfer(source,RESOURCE_ENERGY);
            if( result == OK && Memory.rooms[creep.room.name].links) {
                let baseLink = Game.getObjectById(Memory.rooms[creep.room.name].links.baseLink);
                if( baseLink.store.getUsedCapacity(RESOURCE_ENERGY) <= 220 ) {
                    delete creep.memory.dropOffOveride;
                }
                return;
            }
        }

        if(Memory.rooms[creep.room.name].links)
            this.emptyBaseLinkEnergy(creep);

        if(creep.memory.transport) {
            var target = false;
            
            if(creep.memory.targetLock) {
                var targetLock = Game.getObjectById(creep.memory.targetLock);
                if( targetLock && targetLock.store.getFreeCapacity(RESOURCE_ENERGY) > 20) {//avoid link transfer cost leaving small energy gaps to call for refilling
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
                        (structure.structureType == STRUCTURE_TERMINAL && structure.store.getUsedCapacity(RESOURCE_ENERGY) < 20000) ||
                        (structure.structureType == STRUCTURE_CONTAINER && creep.room.storage) || //only fill containers if we have a store.
                        (structure.structureType == STRUCTURE_LINK && Game.rooms[creep.room.name].memory.links && Game.rooms[creep.room.name].memory.links.baseLink == structure.id && this.linkIsValidRefillTarget(creep)) || // only target link if its baselink
                        structure.structureType == STRUCTURE_TOWER) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 5;//avoid link transfer cost leaving 1 energy gaps to call for refilling
                }
            });
            
            //first section above will targetLock link that may not be filled since link is reserved at 220 levels
            if(target && target.structureType == STRUCTURE_LINK && !this.linkIsValidRefillTarget(creep)) {
                this.getNewRefillTarget(creep,targets);
                target = Game.getObjectById(creep.memory.targetLock);
            }
            
            if(targets.length > 1) {
                for(var i=1;i<targets.length;i++) {
                    if(creep.pos.isNearTo(targets[i])) {

                        if( targets[i].structureType == STRUCTURE_LINK && 
                            Object.keys(Memory.rooms[creep.room.name].links).length > 2 && 
                            targets[i].store.getUsedCapacity(RESOURCE_ENERGY) < 220) {
                                result = creep.transfer(targets[i], RESOURCE_ENERGY,
                                    Math.min(220 - targets[i].store.getUsedCapacity(RESOURCE_ENERGY),creep.store.getUsedCapacity(RESOURCE_ENERGY)) );
                        }
                        else if ((Memory.rooms[creep.room.name].links && Object.keys(Memory.rooms[creep.room.name].links).length <= 2) || (Memory.rooms[creep.room.name].links && Object.keys(Memory.rooms[creep.room.name].links).length > 2 && targets[i].structureType != STRUCTURE_LINK))
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
                    if( target.structureType == STRUCTURE_LINK && 
                        Object.keys(Memory.rooms[creep.room.name].links).length > 2 && 
                        target.store.getUsedCapacity(RESOURCE_ENERGY) < 220) {                             
                            result = creep.transfer(target, RESOURCE_ENERGY,
                                Math.min(220 - target.store.getUsedCapacity(RESOURCE_ENERGY),creep.store.getUsedCapacity(RESOURCE_ENERGY)) );
                    }
                    else {
                        result = creep.transfer(target, RESOURCE_ENERGY);
                        if( result == OK ) {
                            delete creep.memory.targetLock;
                        }
                    }
                    
                }
                
                //transferred some energy but still not at target
                if( !creep.pos.isNearTo(target) && (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) ) {                            
                    creep.Move(target, {ignoreCreeps: false,range:1,priority:5});
                    return;
                }

                //if we reached our target and transferred successfully, release targetLock
                if(result == OK && creep.pos.isNearTo(target)) {
                    delete creep.memory.targetLock;
                    this.getNewRefillTarget(creep,targets);
                    target = Game.getObjectById(creep.memory.targetLock);
                    if( !creep.pos.isNearTo(target) && (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) ) {                            
                        creep.Move(target, {ignoreCreeps: false,range:1,priority:5});
                        return;
                    }
                    return;
                }
            }
            else if (Memory.rooms[creep.room.name] && Memory.rooms[creep.room.name].links)
                this.emptyBaseLinkEnergy(creep, true);
            
        }
        //TODO what if there's no storage? need to have fallback behaviour.
        //pickup mode
        else {
            this.getSource(creep);
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
     * 
     * @param {Creep} creep 
     */
    decideTransition: function(creep) {

    },

    /**
     * Takes from a source or travels to it
     * @param {Creep} creep 
     */
    getSource: function(creep) {
        
        let alreadyTravelled = false;
        let result;
            
        if( Memory.rooms[creep.room.name] && Memory.rooms[creep.room.name].links) {
            let roomLinks = Memory.rooms[creep.room.name].links;
            if ( Object.keys(roomLinks).length > 2 ) {
                let baseLink = Game.getObjectById(Memory.rooms[creep.room.name].links.baseLink);
                if( baseLink && (baseLink.store.getUsedCapacity(RESOURCE_ENERGY) > 220) )
                    result = creep.withdraw(baseLink,RESOURCE_ENERGY,baseLink.store.getUsedCapacity(RESOURCE_ENERGY) - 220);
                if( result == ERR_NOT_IN_RANGE) {
                    creep.Move(baseLink, {ignoreCreeps: false,range:1,priority:5});
                    alreadyTravelled = true;
                }
            }
        }
        
        if( creep.room.storage ) {
            var source = creep.room.storage;
            if( source && !creep.memory.dropOffOveride ) {
                result = creep.withdraw(source,RESOURCE_ENERGY);
                if( result == ERR_NOT_IN_RANGE && !alreadyTravelled ) {
                    creep.Move(source, {ignoreCreeps: false,range:1,priority:5});
                }
            }
            else if( source && creep.memory.dropOffOveride ) {
                result = creep.transfer(source,RESOURCE_ENERGY);
                if( result == OK ) {
                    delete creep.memory.dropOffOveride;
                    return;
                }
            }
        }
        else {
            let source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (structure) => {
                    return ( structure.structureType == STRUCTURE_CONTAINER ) &&
                        structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
                }
            });
    
            if( source && !creep.memory.dropOffOveride) {
                result = creep.withdraw(source,RESOURCE_ENERGY);
                if( result == ERR_NOT_IN_RANGE ) {
                    creep.Move(source, {ignoreCreeps: false,range:1,priority:5});
                }
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
                        (structure.structureType == STRUCTURE_TERMINAL && structure.store.getUsedCapacity(RESOURCE_ENERGY) < 20000) ||
                        (structure.structureType == STRUCTURE_CONTAINER && creep.room.storage) || //only fill containers if we have a store.
                        (structure.structureType == STRUCTURE_LINK && Game.rooms[creep.room.name].memory.links && Game.rooms[creep.room.name].memory.links.baseLink == structure.id && this.linkIsValidRefillTarget(creep)) || // only target link if its baselink
                        structure.structureType == STRUCTURE_TOWER) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY);//avoid link transfer cost leaving 1 energy gaps to call for refilling
                }
            });
        }

        if(targets[0]) {
            var target = targets[0];
            creep.memory.targetLock = target.id;
        }        
    },

    emptyBaseLinkEnergy(creep, doTravel = false) {

        let roomLinks = Memory.rooms[creep.room.name].links;
        let result;
        if ( Object.keys(roomLinks).length > 2 ) {

            if(doTravel) {
                if(creep.store.getUsedCapacity() > 0) {
                    result = creep.transfer(creep.room.storage,RESOURCE_ENERGY);
                    if( result == ERR_NOT_IN_RANGE) {
                        creep.Move(creep.room.storage,{priority:5});
                        creep.memory.dropOffOveride = true;
                        return;
                    }
                    if( result == OK ) {
                        delete creep.memory.dropOffOveride;
                        return;
                    }
                }
            }

            let baseLink = Game.getObjectById(Memory.rooms[creep.room.name].links.baseLink);
            if( baseLink && (baseLink.store.getUsedCapacity(RESOURCE_ENERGY) <= 220 && creep.memory.dropOffOveride) ) {
                delete creep.memory.dropOffOveride;
            }
            if( baseLink && (baseLink.store.getUsedCapacity(RESOURCE_ENERGY) > 220) )
                result = creep.withdraw(baseLink,RESOURCE_ENERGY,Math.min(creep.store.getFreeCapacity(),baseLink.store.getUsedCapacity(RESOURCE_ENERGY) - 220));
            if( result == ERR_NOT_IN_RANGE && doTravel) {
                result = creep.Move(baseLink, {ignoreCreeps: false,range:1,priority:5});
            }
        }
    },

    linkIsValidRefillTarget(creep) {
        let roomLinks = Memory.rooms[creep.room.name].links;
        let result;
        let isValid = false;

        if ( Object.keys(roomLinks).length == 2 ) {
            isValid = true;
        }

        if ( Object.keys(roomLinks).length > 2 ) {
            let baseLink = Game.getObjectById(Memory.rooms[creep.room.name].links.baseLink);
            if( baseLink && (baseLink.store.getUsedCapacity(RESOURCE_ENERGY) < 220) )
                isValid = true;
        }


        return isValid;
    }
};

module.exports = roleRefiller;