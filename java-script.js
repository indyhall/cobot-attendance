(function() {
  'use strict';

  var cobot = Cobot.Api(window.cobot.access_token);
  var storage = Cobot.Storage(window.cobot.storage_token);
  var subdomain = window.cobot.subdomain;

  // app
  window.App = Ember.Application.create();

  // routes
  App.Router.map(function () {
    this.route('index', { path: '/' });
  });

  App.IndexRoute = Ember.Route.extend({
    model: function() {
      return Ember.RSVP.hash({
        checkIns: cobot.get(subdomain, '/check_ins'),
        memberships: cobot.get(subdomain, '/memberships'),
      });
    }
  });

  // controllers
  App.IndexController = Ember.Controller.extend({
    subdomain: subdomain,
    activeCheckins: Ember.computed.filter('model.checkIns', function(checkin) {
      var untilTime = new Date(checkin.valid_until)
      return untilTime >= new Date();
    }),

    activeMemberships: Ember.computed('model.memberships', function() {
      var checkins = this.get('activeCheckins');
      return this.get('model.memberships').map(function(membership) {
        var isCheckedIn = checkins.find(function(checkin) {
          return checkin.membership_id === membership.id;
        });

        Ember.set(membership, 'isCheckedIn', isCheckedIn);
        return membership;
      });
    }),

    checkMeIn(membership) {
      return cobot.post(subdomain, "/memberships/" + membership.id + "/work_sessions");
    },

    buyNewPass(membership) {
      var time_pass = membership.plan.time_passes.get('firstObject');

      return cobot.post(subdomain, "/memberships/" + membership.id + "/time_passes", {
        no_of_passes: 1,
        charge: "charge",
        id: time_pass.id
      });
    },

    actions: {
      checkIn(membership) {
        var that = this;
        this.checkMeIn(membership).then(function(response) {
          // Success
        }, function(error) {
          var errorText = error.responseJSON.base[0];
          var notEnoughPasses = errorText.includes('No time passes left')
          if (notEnoughPasses) {
            that.buyNewPass(membership).then(function(response) {
              that.checkMeIn(membership);
            })
          } else {
            window.confirm(errorText);
          }
        });

        Ember.set(membership, 'isCheckedIn', true);
      },

      checkOut(membership) {
        cobot._delete(subdomain, "/memberships/" + membership.id + "/check_ins/current")
        Ember.set(membership, 'isCheckedIn', undefined);
      }
    }
  });


  // resize window
  window.setInterval(function() {
    if(window != window.top) {
      window.Cobot.iframeResize($('body').outerHeight());
    }
  }, 200);
})();
