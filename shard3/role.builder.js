var roleBuilder = {

    /** @param {Creep} creep **/
    run: function(creep) {
        try {
            if(creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
                creep.memory.building = false;
                creep.say('🔄 source');
            }
            if((!creep.memory.building && creep.store[RESOURCE_ENERGY] != 0) && (!creep.memory.hasHarvested || creep.memory.hasHarvested == 0 || creep.store.getFreeCapacity() == 0)) {
                creep.memory.building = true;
                creep.say('🚧 build');
            }
    
            if(creep.memory.building) {
                
                let targetRoom = creep.memory.targetRoom;
                let targetLock = creep.memory.targetLock;
                let target;
                
                if(targetLock) {
                    target = Game.getObjectById(targetLock);
                    if(creep.room.name != targetRoom) {
                        creep.travelTo(
                            new RoomPosition(
                                target.pos.x,
                                target.pos.y,
                                targetRoom),
                            { ignoreCreeps:false,
                            range:3,
                            reusePath:10});
                    }
                }
                
                if(targetRoom) {
                    if(creep.room.name != targetRoom) {
                        if(!Game.rooms[targetRoom]) {

                            creep.travelTo(new RoomPosition(25,25,targetRoom), {ignoreCreeps:false,swampCost:1,range:1,maxRooms:4}); // TODO if targetlock true, i have precise dest, why move to room center?
                           // console.log(`Builder ${creep.name} couldn't see Game's room ${targetRoom} while being in ${creep.room.name}`);
                            return;
                        }
                        var buildSites = Game.rooms[targetRoom].find(FIND_CONSTRUCTION_SITES);
                        if(buildSites.length > 0)
                            creep.travelTo(new RoomPosition(buildSites[0].pos.x,buildSites[0].pos.y,targetRoom), {ignoreCreeps:false,swampCost:1,range:1,maxRooms:4,reusePath:10});
                        else
                            creep.travelTo(new RoomPosition(25,25,targetRoom), {ignoreCreeps:false,swampCost:1,range:1,maxRooms:4});// extra safety incase
                        return;
                    }
                    
                }
                
                var targets = creep.room.find(FIND_CONSTRUCTION_SITES);
                if(targets.length) {
                    if(creep.build(targets[0]) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(targets[0], {range:3,maxRooms:1});
                    }
                }
                else {
                    var targets = creep.room.find(FIND_MY_STRUCTURES, {
                        filter: (structure) => {
                            return (structure.hits < structure.hitsMax) &&
                                structure.hits < 300000;
                        }});
                        
                    if(targets[0]) {
                        if(creep.repair(targets[0]) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(targets[0], {ignoreCreeps: false,range:3,maxRooms:1});
                        }
                        return; //early return if i could do this, toa void running below code
                    }
                    
                    targets = creep.room.find(FIND_STRUCTURES, {
                        filter: (structure) => {
                            return (structure.hits < structure.hitsMax) &&
                                (structure.structureType == STRUCTURE_ROAD ||
                                structure.structureType == STRUCTURE_CONTAINER);
                        }});
                    
                    if(targets[0]) {
                        if(creep.repair(targets[0]) == ERR_NOT_IN_RANGE) {
                            let cpu = Game.cpu.getUsed();
                            creep.moveTo(targets[0],{range:3});
                            let cpuUsed = Game.cpu.getUsed() - cpu;
                            let delta = _.round(cpuUsed);
                            if (delta > 500) {
                                // see note at end of file for more info on this
                                console.log(`DEFAULT MOVING: heavy cpu use: ${creep.name}, cpu: ${state.cpu} origin: ${creep.pos}, dest: ${destination}`);
                            }
                            
                            //creep.travelTo(targets[0], {ignoreCreeps: false,range:3,maxRooms:1}); //seems i get a lot of high cpu use here
                        }
                        return; //early return if i could do this, toa void running below code
                    }
                    
                    targets = creep.room.find(FIND_STRUCTURES, {
                        filter: (structure) => {
                            return (structure.hits < structure.hitsMax) &&
                                structure.structureType == STRUCTURE_RAMPART &&
                                structure.hits < 2000000;
                        }});
                    
                    if(targets[0]) {
                        if(creep.repair(targets[0]) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(targets[0],{ignoreCreeps: false,range:3,maxRooms:1});
                        }
                        return; //early return if i could do this, toa void running below code
                    }
                    
                    if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(creep.room.controller, {ignoreCreeps: false,range:1,maxRooms:1});
                    }
                }
                
            }
            else { //roadworkers sometimes get stuck on room edges sometimes no idea how/why, must still debug that.
                
                if(!creep.room.storage) {
                    var source = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
                    
                    if(source) {
                        var result = creep.pickup(source);
                        
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
                                creep.memory.hasHarvested = 25;
                        }
                    }
                
                }
                else {
                    var source = creep.room.storage;
                    
                    var result = creep.withdraw(source,RESOURCE_ENERGY);
                    
                    if(result == ERR_NOT_IN_RANGE) {
                        creep.travelTo(source, {ignoreCreeps: false,range:1,maxRooms:1,reusePath:8});
                    }
                }
            }
        }
        catch {
            console.log('builder threw exception: ' + creep.name);
        }
    }
};

module.exports = roleBuilder;