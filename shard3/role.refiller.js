/* Summarized Behaviour
**
** Refillers depend on a room Storage and Prioritization of refilling targets is Base Link and then filling things on the way, otherwise drop in Storage as fall-back
**
** 1 - If creep cargo is empty, switch to pickup mode through 'transport' state attribute = false
** 2 - If creep cargo full, switch to dropoff mode through 'transport' = true

** 3 - if in dropoff mode, check if have targetlock with a store attribute for pickup and if so, fill structures on our way moving there
** 4 - if targetLock target has no free capacity, switch to fillable structures as target to go for as fallback
** 5 - as discussed in #3, fill thigns on way to targetLocked target
** 6 - if we didn't get an early function return because of #5 happening, it means we haven't transferred energy yet, so might be at target to do it now, and if successful, release targetLock

** 7 - if we didn't have a targetLock for the above block of code to run with, check homeRoom attribute, find a link, and go fill it up
** 8 - if no targets to go fill up that has space (see #4), then lets go fill up from room's Storage, which is same as pickup behaviour

** 9 - Pickup mode, get from room Storage As #1 shows, pickup mode is on when no energy to transfer or #8 happens
*/

/** Limitations to address asap
 * 1 homeRoom attribute management
 * 2 Dependence on Storage structure - why not behave like transport if no Storage?
 * 3 modularize behaviours as much is shared with transport role
 */

var roleRefiller = {

    /** @param {Creep} creep **/
    run: function(creep) {

        // 1
        if(creep.memory.transport && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.transport = false;
            creep.say('🔄 pickup');
        }
        // 2
        else if(!creep.memory.transport && creep.store[RESOURCE_ENERGY] != 0 ) {
            creep.memory.transport = true;
            creep.say('dropoff');
        }

        // 3
        if(creep.memory.transport) {
            var target = false;
            
            if(creep.memory.targetLock) {
                var targetLock = Game.getObjectById(creep.memory.targetLock);
                if(targetLock.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    target = targetLock;
                }
                else {
                    delete creep.memory.targetLock;
                }
            }
            
            //we want a list of things to refill on our way to our targetlock for efficiency purposes
            var targets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_EXTENSION ||
                        structure.structureType == STRUCTURE_SPAWN ||
                        structure.structureType == STRUCTURE_TOWER) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });

            // 4
            
            //don't have targetLock with free capacity
            if(!target) {
                if(targets[0]) {
                    target = targets[0];
                    creep.memory.targetLock = target.id;
                }
            }
            
            // 5
            //if we're passing something that can be filled on our way to our targetLock, fill it
            if(target) {
                var result;
                if(targets.length > 1) {
                    for(var i=1;i<targets.length;i++) {
                        if(creep.pos.isNearTo(targets[i])) {
                            result = creep.transfer(targets[i], RESOURCE_ENERGY);
                            if(result == OK)
                                break;
                        }
                    }
                }
                
                //transferred some energy but still not at target
                if( result == OK && !creep.pos.isNearTo(target) &&
                    (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) ) {
                        
                    creep.travelTo(target, {ignoreCreeps: false,range:1,reusePath:10});
                    //early return because already made successful intenT
                    return;
                }
                
                //transferred some energy but close enough to target, early return because already made successful intent
                if(result == OK) {
                    return;
                }

                // 6
                
                //if result wasn't OK (i.e. early returns happened yet) it means we haven't transferred energy yet, so might be at target to do it now.
                result = creep.transfer(target, RESOURCE_ENERGY);
                
                if(result == ERR_NOT_IN_RANGE) {
                    creep.travelTo(target, {ignoreCreeps: false,range:1,reusePath:10});
                    return;
                }
                //if we reached our target and transferred successfully, release targetLock
                if(result == OK) {
                    delete creep.memory.targetLock;
                }
                
            }

            // 7
            //TODO handle homeroom logic automatically, doesnt' seem any code for it
            //if we didn't have a targetLock for the above block of code to run with, find Base Link to fill
            if(creep.memory.homeRoom && 
                Memory.rooms[creep.memory.homeRoom].baseLink && 
                Game.getObjectById(Memory.rooms[creep.room.name].baseLink).store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    
                var baseLink = Game.getObjectById(Memory.rooms[creep.room.name].baseLink);
                target = baseLink;
                creep.memory.targetLock = baseLink.id;
            }
            
            //TODO isn't this repeat of above? move to function and call it rather than copy pasta code?
            if(target) {
                var result;
                //repeated code of transferring to structures on our way to target
                if(targets.length > 1) {
                    for(var i=1;i<targets.length;i++) {
                        if(creep.pos.isNearTo(targets[i])) {
                            result = creep.transfer(targets[i], RESOURCE_ENERGY);
                            if(result == OK)
                                break;
                        }
                    }
                }
                
                if( result == OK && !creep.pos.isNearTo(target) ) {
                    creep.travelTo(target, {ignoreCreeps: false,range:1,reusePath:10});
                    return;
                }
                
                result = creep.transfer(target, RESOURCE_ENERGY);
                if(result == OK) {
                    return;
                }
                
                if(result == ERR_NOT_IN_RANGE) {
                    creep.travelTo(targets[0], {ignoreCreeps: false,range:1});
                    return;
                }
            }

            // 8
            
            //no targets, so lets go refill from storage.
            let source = creep.room.storage;
            if( source )
                if( creep.withdraw(source,RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.travelTo(source, {ignoreCreeps: false,range:1,reusePath:10});
                }
        }

        // 9
        //TODO what if there's no storage? need to have fallback behaviour.
        //pickup mode
        else {
            var source = creep.room.storage;
            if( source ) {
                var result = creep.withdraw(source,RESOURCE_ENERGY);
                if( result == ERR_NOT_IN_RANGE) {
                    creep.travelTo(source, {ignoreCreeps: false,range:1,reusePath:10});
                }
            }
        }
    }
};

module.exports = roleRefiller;