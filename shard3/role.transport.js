/** Summarized Behaviour
 *
 * */ 



var roleTransport = {

    /** @param {Creep} creep **/
    run: function(creep) {

        if(creep.memory.transport &&
            creep.store[RESOURCE_ENERGY] == 0) {
                
            creep.memory.transport = false;
            creep.say('🔄 pickup');
        }
        else if(
            !creep.memory.transport &&
            
            ((creep.store[RESOURCE_ENERGY] != 0 &&
            (creep.room.name == creep.memory.homeRoom) ) ||
            
            (creep.store.getFreeCapacity() == 0 &&
            (creep.room.name != creep.memory.homeRoom)) )
            ) {
                    
            creep.memory.transport = true;
            creep.say('dropoff');
        }

        if(creep.memory.transport) {
            var targetRoom = creep.memory.targetRoom;
            if(targetRoom && creep.room.name != Memory.homeRoom) {
                creep.travelTo(new RoomPosition(30,25,Memory.homeRoom), {ignoreCreeps:true,range:5}); //check if this is main cuase of heavy cpu use
                return;
            }
                
            var targets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_EXTENSION ||
                        structure.structureType == STRUCTURE_SPAWN ||
                        structure.structureType == STRUCTURE_TOWER ||
                        structure.structureType == STRUCTURE_LINK) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
            
            //prioritize storage as destination
            if(creep.room.storage && creep.room.storage.store.getFreeCapacity() > 0) {
                let result = -1000;
                if(!creep.pos.isNearTo(creep.room.storage) ) {
                    creep.travelTo(creep.room.storage, {ignoreCreeps: false,range:1,maxRooms:1});
                }
                else {                            
                    result = creep.transfer(creep.room.storage, RESOURCE_ENERGY);
                    return;
                }
                
                if(targets.length > 1) {
                    for(var i=1;i<targets.length;i++) {
                        if(creep.pos.isNearTo(targets[i])) {
                            result = creep.transfer(targets[i], RESOURCE_ENERGY);
                            if(result == OK)
                                break;
                        }
                    }
                }
                return;
            }
            
            //console.log(JSON.stringify(targets));
            
            if(targets[0]) {
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
                
                if( result == OK && !creep.pos.isNearTo(targets[0]) ) {
                    creep.travelTo(targets[0], {ignoreCreeps: false,range:1,maxRooms:1});
                    return;
                }
                
                result = creep.transfer(targets[0], RESOURCE_ENERGY);
                //console.log(result);
                if(result == ERR_NOT_IN_RANGE) {
                    creep.travelTo(targets[0], {ignoreCreeps: false,range:1,maxRooms:1});
                }
            }
            else {
                creep.travelTo(Game.rooms[Memory.homeRoom].controller,{range:4}); // this bugs out to other rooms for some reason if i check its own room. why though?
                var range = creep.pos.getRangeTo(creep.room.controller.pos);
                if(range == 4)
                    creep.drop(RESOURCE_ENERGY);
            }
        }
        else {
            var targetRoom = creep.memory.targetRoom;
            if(targetRoom) {
                if(creep.room.name != targetRoom) {
                    var target = Game.getObjectById(creep.memory.target);
                    if(target)
                        creep.travelTo(new RoomPosition(target.pos.x,target.pos.y,creep.memory.targetRoom), {range:4});
                    else {
                        creep.travelTo(new RoomPosition(25,25,creep.memory.targetRoom), {range:10});
                    }
                    return;
                }
            }
            
            //first determine if targetted hauling and execute if so, early return to avoid defaulting cleaning behaviour
            var target = Game.getObjectById(creep.memory.target);
            var targetIsDry = false;
            
            //check if target is dry
            if( target ) {
                var source = target.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
                if( source && !target.pos.inRangeTo(source,4)) {
                    targetIsDry = true;
                }
            }
            
            
            if(target) {
                var result;
                if(creep.pos.inRangeTo(target,4)) { //small swamps can screw up 2 range, so make it 4 before looking for dropped res
                    var source = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
                    
                    if( source && creep.pos.inRangeTo(source,4) ) {
                        result = creep.pickup(source);
                        if( result == ERR_NOT_IN_RANGE) {
                            creep.travelTo(source, {ignoreCreeps: false,range:1,maxRooms:1});
                        }
                        if( result == OK ) {
                            return;
                        }
                    }
                    else {
                        targetIsDry = true;
                    }
                }
                //if not within 4 range of source nor within range of dropped resources
                if( !targetIsDry ) {
                    result = creep.travelTo(target, {ignoreCreeps: false,range:4,maxRooms:1}); //small swamps can screw up 2 range, so make it 4 before looking for dropped res
                    return;
                }
                    // if(creep.name == 'c0.7974505138169041' )
                    //     console.log(JSON.stringify(creep.));
                
            }
            
            
            //if no targetted hauling, default to cleaning up dropped resources
            var source = Game.getObjectById(creep.memory.source);
            
            if(!source) {
                var sources = creep.room.find(FIND_DROPPED_RESOURCES);
                
                if(sources.length > 1) {
                    var biggestPile = 0;
                    for(var i = 1; i < sources.length; i++) {
                        if (sources[i].amount > sources[biggestPile].amount) {
                            biggestPile = i;
                        }
                    }
                    source = sources[biggestPile];
                    creep.memory.source = source.id;
                }
                else if(sources[0]) {
                    source = sources[0];
                    creep.memory.source = sources[0].id;
                }
            }
            else {
                source = Game.getObjectById(creep.memory.source);
            }
            
            if(source) {
                if(creep.pickup(source) == ERR_NOT_IN_RANGE) {
                    creep.travelTo(source, {ignoreCreeps: false,range:1,maxRooms:1});
                }
            }
        }
    }
};

module.exports = roleTransport;