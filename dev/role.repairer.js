var u = require('util.common');
var taskCommon = require('task.common');
const { __esModule } = require('./Traveler');

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
            var result;
            let target = Game.getObjectById(creep.memory.target);

            if(!creep.memory.targetRoom) {
                creep.memory.targetRoom = creep.memory.homeRoom;
            }

            if(creep.memory.targetRoom && creep.room.name != creep.memory.targetRoom) {
                creep.travelTo(
                    new RoomPosition(
                        25,
                        25,
                        creep.memory.targetRoom),
                    { range:10,
                    reusePath:10});
                return;
            }
            
            var targets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.hits < structure.hitsMax) &&
                        structure.hits < 300000;
                }});

            if(targets.length > 0 && (!target || target.hits == target.hitsMax || target.hits > 300000)) {
                creep.memory.target = targets[0].id;
                target = Game.getObjectById(creep.memory.target);
            }
    
            if(targets.length > 0) {
                for(var i=0;i<targets.length;i++) {
                    if(creep.pos.isNearTo(targets[i])) {
                        result = creep.repair(targets[i]);
                        //this check prevents getting stuck on room borders if not moving off them with early return
                        if(target && target.room.name == creep.memory.targetRoom)
                            if(result == OK)
                                return;
                    }
                }
            }
                
            if(target) {
                result = creep.repair(target);
                if(result == ERR_NOT_IN_RANGE) {
                    creep.travelTo(target, {ignoreCreeps: false,range:3,maxRooms:1});
                    return;
                }
                if(result == OK)
                    return; //early return if i could do this, toa void running below code
            }
            
            targets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.hits < ( structure.hitsMax - 1000 )) && // the -1000 modifier is to allow things like walls etc to be built up when roads etc are in relatively good condition
                        (structure.structureType == STRUCTURE_ROAD ||
                        structure.structureType == STRUCTURE_CONTAINER);
                }});
    
            if(targets.length > 0 && (!target || target.hits == target.hitsMax)) {
                creep.memory.target = targets[0].id;
                target = Game.getObjectById(creep.memory.target);
            }
            
            if(target) {
                result = creep.repair(target);
                if(result == ERR_NOT_IN_RANGE) {
                    creep.travelTo(target, {ignoreCreeps: false,range:3,maxRooms:1});
                    return;
                }
                //this check prevents getting stuck on room borders if not moving off them with early return
                if(target && target.room.name == creep.room.name)
                    if(result == OK)
                        return; //early return if i could do this, toa void running below code
            }
            
            targets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.hits < structure.hitsMax) &&
                        (structure.structureType == STRUCTURE_RAMPART ||
                        structure.structureType == STRUCTURE_WALL) &&
                        structure.hits < 2000000;
                }});
    
            if(targets.length > 0 && (!target || target.hits == target.hitsMax || target.hits > 2000000)) {
                creep.memory.target = targets[0].id;
                target = Game.getObjectById(creep.memory.target);
            }
            
            if(target) {
                result = creep.repair(target);
                if(result == ERR_NOT_IN_RANGE) {
                    creep.travelTo(target, {ignoreCreeps: false,range:3,maxRooms:1});
                    return;
                }
                //this check prevents getting stuck on room borders if not moving off them with early return
                if(target && target.room.name == creep.room.name)
                    if(result == OK)
                        return; //early return if i could do this, toa void running below code
            }
            
            if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.travelTo(creep.room.controller, {ignoreCreeps: false,range:1,maxRooms:1});
            }
        }
        else {

            var source = taskCommon.getClosestEnergy(creep);
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