var taskCommon = require('task.common');

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
                let target = Game.getObjectById(targetLock);
                
                if(!target) {
                    var buildSites = Game.rooms[creep.room.name].find(FIND_CONSTRUCTION_SITES);
                    if(buildSites.length > 0) {
                        targetLock = buildSites[0].id;
                        target = Game.getObjectById(targetLock);
                        
                        creep.memory.targetLock = targetLock;
                        creep.memory.targetRoom = target.room.name;
                    }
                }

                if(!targetRoom) {
                    //if we can see target, it means we can set targetRoom from it
                    if( target ) {
                        targetRoom = target.room.name;
                        creep.memory.targetRoom = targetRoom;
                    }
                }
                        
                if(target) {
                    var result = creep.build(target);

                    try {

                        if(result == ERR_NOT_IN_RANGE) {
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
                    catch(problem) {
                        console.log(`Exception builder: ${problem.name}: ${problem.message} ${problem.stack}  `);
                    }
                    
                    return;
                }
                else if(creep.room.name != targetRoom) {
                    var destRoom = new RoomPosition(25,25,targetRoom);
                    creep.travelTo(destRoom, {ignoreCreeps:false,swampCost:1,range:1,maxRooms:4});
                    return;
                }
                //no targets set and we're in same room as we think we should be, so look for sites to build
                else {
                    var buildSites = Game.rooms[creep.room.name].find(FIND_CONSTRUCTION_SITES);
                    if(buildSites.length > 0) {
                        target = buildSites[0];
                        creep.memory.target = target;
                    }
                }
                
                //defaulting behaviour
                if(!target) {
                    this.doRepair(creep);
                }
                
            }
            else { //TODO roadworkers sometimes get stuck on room edges sometimes no idea how/why, must still debug that.
                
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
                            else {
                                let capacity = creep.store.getFreeCapacity();
                                let workParts = _.filter(creep.body, function(b) {return b.type == WORK});
                                let harvestRate = workParts.length*2;
                                creep.memory.hasHarvested = capacity/(harvestRate*2);
                            }
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
        catch (problem) {
            console.log(`Exception builder: ${problem.name}: ${problem.message} ${problem.stack}  `);
        }
    },

    //TODO needs optimization badly
    /** @param {Creep} creep **/
    doRepair: function(creep) {
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
};

module.exports = roleBuilder;