var roleAttacker = {

    /** @param {Creep} creep **/
    run: function(creep) {
        try {
            if(!creep.memory.target)
                creep.heal(creep);
                
            var target = Game.getObjectById(creep.memory.target);
            if(!target) {
                var isRemoteRoom = false;
                //first check if remote room
                if(creep.room.name != creep.memory.targetRoom) {
                    isRemoteRoom = true;

                    let result = creep.travelTo(new RoomPosition(25,25,creep.memory.targetRoom),{range:1}); //TODO better way to determine room entry e.g. hostile position, retrieved from hostile alert saved(todo) somewhere?
                    return;
                }
                
                if(!isRemoteRoom) {
                    target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
                    if(target)
                        creep.memory.target = target.id;
                }
                
                if(!target) {
                    target = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES);
                    if(target && target.structureType != STRUCTURE_CONTROLLER)
                        creep.memory.target = target.id;
                }
            }
            
            if(target) {
                var result = creep.attack(target);
                //console.log("attacker result "+JSON.stringify(result));
                if(result == ERR_NOT_IN_RANGE) {
                    creep.travelTo(target,{range:1});
                }
            }
            else {
                delete creep.memory.target;
                let result = creep.travelTo(creep.room.controller,{range:2,swampCost:1,reusePath:10});
            }
        }
        catch {
            console.log('role.attacker threw exception: '+creep.Namespace);
        }
    }
};

module.exports = roleAttacker;