var baseCommon = require('base.common');
var u = require('util.common');

/** Limitations
 * 1 - creep.memory.target isn't automatically set
 * 2 - creep doesn't wait until full when waiting for harvester drops before returning to drop off
 * 3 - TODO How to keep transport coverage updated e.g. if i get bigger transfers with spawning of new transport creep etc.
 */

/** Summarized Behaviour
 *
 * */ 

var roleSupplier = {

    /** @param {Creep} creep **/
    run: function(creep) {

        if( Game.time % 20 == 0) {
            if(creep.store.getUsedCapacity() == 0 && creep.ticksToLive < 200 )
                creep.suicide();
        }

        this.checkTransition(creep);

        //drop off
        if(creep.memory.working) {
            let result = -1000;
            let dropoffTarget = Game.getObjectById(creep.memory.dropoffTarget);

            //for now set storage as dropoff var target (not memory target)
            if( !dropoffTarget || dropoffTarget.store.getFreeCapacity(RESOURCE_ENERGY) == 0) {
                if( Game.rooms[creep.memory.homeRoom].storage ) {
                    creep.memory.dropoffTarget = Game.rooms[creep.memory.homeRoom].storage.id;
                    dropoffTarget = Game.getObjectById(creep.memory.dropoffTarget);
                }
            }
            
            if(dropoffTarget && dropoffTarget.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                if(!creep.pos.isNearTo(dropoffTarget) ) {
                    creep.Move(dropoffTarget, {ignoreCreeps: true,range:1,priority:2,allowSK:true});
                    return;
                }
                else {
                    for(const resourceType in creep.store) {
                        result = creep.transfer(dropoffTarget, resourceType); //TODO have to transfer all things not just energy
                        // u.debug(resourceType,`stateEmptyStore in drop logic`);
                        if( result == OK )
                            break;
                    }
                    
                    if( result != OK ) {
                        console.log(`WARNING: supplier creep ${creep.name} couldn't transfer to target while next to it`);
                    }
                    else {
                        this.checkTransition(creep);
                        //if transition successful
                        if( creep.memory.working == false )
                            creep.Move(Game.getObjectById(creep.memory.pickupTarget), {ignoreCreeps: true,range:1,priority:2,allowSK:true});// not same as target around here, but is actual pickup target
                        return;
                    }
                }
                
            }; 

            //if we get here, it means none of the early returns happened and we can't drop off energy in structures, so go to controller to feed upgraders.
            
            if( !Game.rooms[creep.memory.homeRoom].storage ) {

                creep.Move(Game.rooms[creep.memory.homeRoom].controller,{ignoreCreeps: true,range:4,priority:2,allowSK:true}); // this bugs out to other rooms for some reason if i check its own room. why though?
                if(creep.room.name == creep.memory.homeRoom) {
                    var range = creep.pos.getRangeTo(creep.room.controller.pos);
                    if(range == 4)
                        creep.drop(RESOURCE_ENERGY);
                }
            }
            
        }
        //pickup
        else {
            var target = Game.getObjectById(creep.memory.pickupTarget);

            //if we can't get a valid target from memory, it means we have to re-assign a new one.
            try {
                if(!target && (creep.store.getFreeCapacity() < (creep.store.getCapacity()/4))) {
                    creep.memory.working = true;
                }

            }
            catch(problem) {
                console.log("Excpetion in role.supplier getting candidateTargets: "+ problem.name + ": " + problem.message + " " + problem.stack);
            }
            
            if(target) {
                var result;
                if(creep.pos.isNearTo(target)) {
                    var source = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
                    if( source && creep.pos.isNearTo(source) && target.pos.isNearTo(source) ) {
                        result = creep.pickup(source);
                        if( result == ERR_NOT_IN_RANGE) {
                            creep.Move(source, {ignoreCreeps: true,range:1,priority:2,allowSK:true});
                            return;
                        }
                        if( result == OK ) {
                            this.checkTransition(creep);
                            return;
                        }
                    }
                    else {
                        let target = Game.getObjectById(creep.memory.pickupTarget);
                        if( !target ) {
                            delete creep.memory.pickupTarget;
                            return;
                        }

                        //testing this to see if bug still occuring
                        result = creep.pickup(target);
                        if(result == OK && (creep.store.getFreeCapacity() < (creep.store.getCapacity()/4))) {
                            creep.memory.working = true;
                            let dropoffTarget = Game.getObjectById(creep.memory.dropoffTarget);
                            if( dropoffTarget )
                                creep.Move(dropoffTarget, {ignoreCreeps: true,range:1,priority:2,allowSK:true});
                        }

                        if( result == ERR_INVALID_TARGET) {
                            for(const resourceType in target.store) {
                                if( resourceType != RESOURCE_ENERGY)
                                    result = creep.withdraw(target,resourceType);
                                if( result == OK )
                                    break;
                            }
                        }

                        // if( result == ERR_INVALID_TARGET) {
                        //     if( target.owner.username == "Malkaar" )
                        //         for(const resourceType in creep.store) {
                        //             if( resourceType != RESOURCE_ENERGY && resourceType != RESOURCE_OXYGEN)
                        //                 result = target.transfer(creep,resourceType);
                        //             if( result == OK )
                        //                 break;
                        //         }
                        // }
                        if( result == ERR_NOT_IN_RANGE) {
                            creep.Move(target, {ignoreCreeps: true,range:1,priority:2,allowSK:true});
                            return;
                        }
                        if( result == OK ) {
                            return;
                        }
                    }
                }
                else {

                    let nearbyResources = this.lookForNearbyResources(creep);
                    if( nearbyResources.length > 0 ) {
                        this.pickupNearbyResources( creep, nearbyResources );
                    }
                    

                    result = creep.Move(target, {ignoreCreeps: true,range:1,priority:2,allowSK:true});
                    return;
                }
            }
            
            //if no valid target could be found, look to make dropped source pile a target
            if(!target) {
            
                var sources = creep.room.find(FIND_DROPPED_RESOURCES);
                
                if(sources) {              
                    var source;      
                    if(sources.length > 1) {
                        var biggestPile = 0;
                        for(var i = 1; i < sources.length; i++) {
                            if (sources[i].amount > sources[biggestPile].amount) {
                                biggestPile = i;
                            }
                        }
                        source = sources[biggestPile];
                        creep.memory.pickupTarget = source.id;
                    }
                    else if(sources[0]) {
                        source = sources[0];
                        creep.memory.pickupTarget = sources[0].id;
                    }
                    //we're in 
                }
            }

            if(!target) {
                creep.Move(Game.rooms[creep.memory.homeRoom].controller, {ignoreCreeps: true,range:1,priority:2,allowSK:true});
            }
        }
    },

    /**
     * 
     * @param {Creep} creep 
     * @returns 
     */
    lookForNearbyResources: function(creep) {

        let nearbyResources = [];

        if( Game.time % 3 === 0) {

            for(let a = -1; a < 2; a++ ) {
                for( let b = -1; b < 2; b++) {

                    let lookX = Math.min( Math.max(creep.pos.x + a,0), 49 );
                    let lookY = Math.min( Math.max(creep.pos.y + b,0), 49 );
                    let lookPos = new RoomPosition(
                        lookX,
                        lookY,
                        creep.room.name);

                    let foundResources = lookPos.lookFor(LOOK_RESOURCES);

                    nearbyResources = nearbyResources.concat( foundResources );
                }
            }
        }

        return nearbyResources;
    },

    pickupNearbyResources: function( creep, nearbyResources ) {

        _.forEach( nearbyResources, (resource) => {

            if( creep.store.getFreeCapacity() == 0 )
                return false; //breaks forEach

            let result = creep.pickup( resource );

            if( result == OK && (creep.store.getFreeCapacity() < (creep.store.getCapacity()/4)) )
                creep.memory.working = true;
            
        } ) ;        

    },

    /**
     * Evaluates state of creep and determines if it should switch modes
     * @param {Creep} creep 
     */
    checkTransition: function(creep) {        
        // if empty, switch to sourcing mode
        if(creep.memory.working && creep.store.getUsedCapacity() == 0) {
            creep.memory.working = false;
            creep.say('🧊');
        }
        // if is full, go work
        else if(!creep.memory.working && creep.store.getFreeCapacity() == 0) {
            creep.memory.working = true;
            creep.say('🍺'); 
        }
    }
};

module.exports = roleSupplier;