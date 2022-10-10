var roleBreaker = {

    /** @param {Creep} creep **/
    run: function(creep) {
        try {
            var targetRoom = creep.memory.targetRoom;
            if(targetRoom) {
                //are we going to a remote room?
                if(targetRoom != creep.room.name) {
                    var result;
                    if(controller)
                        result = creep.travelTo(controller);
                    else
                        result = creep.travelTo(new RoomPosition(25,25,targetRoom),{swampCost:1,range:1});
                    return;
                }
                //else we're in the target room
                else {
                    //if no target was set, get a hostile structure to attack
                    if(!creep.memory.target) {
                        target = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES);
                        if(target && target.structureType != STRUCTURE_CONTROLLER)
                            creep.room.target = target.id;
                    }

                    //continue to dismantle target
                    var result = creep.dismantle(Game.getObjectById(creep.memory.target));
                    if(result == ERR_NOT_IN_RANGE) {
                        creep.travelTo(Game.getObjectById(creep.memory.target), {visualizePathStyle: {stroke: '#ffffff'}});
                    }
                }
            }
        }
        catch (problem) {
            console.log(`Exception thrown: role.breaker: ${problem.name}:${problem.message} ${problem.stack}`);
        }
    }
};

module.exports = roleBreaker;