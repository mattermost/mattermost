/* ============================================================
 * Bootstrap: wizard.js v3.1.2
 * http://jasny.github.io/bootstrap/javascript/#wizard
 * ============================================================
 * Copyright 2012-2014 Arnold Daniels
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ============================================================ */

+function ($) { "use strict";

  var Wizard = function (element, options) {
    this.$element = $(element)
    this.options = options
  }

  Wizard.defaults = {
    donestep: false
  }

  Wizard.prototype.listen = function () {
    this.$element.on('click.bs.wizard', '[data-toggle="wizard"]', $.proxy(this.click, this))
  }
  
  Wizard.prototype.show = function (step) {
    var self = this
    var $target = this.getTarget(step)
    
    if ($target.length === 0 || $target.hasClass('active')) {
        if (step === 'done') this.$element.trigger('done.bs.wizard')
        return
    }
    
    var $active   = this.$element.find('.wizard-step.active')
    var direction = $target.nextAll('.active').length ? 'right' : 'left' 
    var to = direction === 'left' ? 'next' : 'prev'
      
    var e = $.Event('step.bs.wizard', { relatedTarget: $target, direction: to === 'next' ? 'forward' : 'back' })
    this.$element.trigger(e)
    if (e.isDefaultPrevented()) return
    
    if (this.sliding) return this.$element.one('step.bs.wizard', function () { self.show(step) })
    
    this.sliding = true

    if ($.support.transition && this.$element.hasClass('slide')) {
      $target.addClass(to)
      $target[0].offsetWidth // force reflow
      $active.addClass(direction)
      $target.addClass(direction)
      $active
        .one($.support.transition.end, function () {
          $target.removeClass([to, direction].join(' ')).addClass('active')
          $active.removeClass(['active', direction].join(' '))
          self.activate()
          self.sliding = false
          setTimeout(function () { self.$element.trigger('stepped.bs.wizard') }, 0)
        })
        .emulateTransitionEnd($active.css('transition-duration').slice(0, -1) * 1000)
    } else {
      $active.removeClass('active')
      $target.addClass('active')
      this.activate($target)
      this.sliding = false
      this.$element.trigger('stepped.bs.wizard')
    }
  }
  
  Wizard.prototype.refresh = function() {
    var $target = this.$element.find('.wizard-step.active')
    if ($target.length === 0) $target = this.$element.find('.wizard-step').first()
    
    $target.addClass('active')
    this.activate($target)
  }
  
  Wizard.prototype.getTarget = function (step) {
    var $target
    var $active = this.$element.children('.wizard-step.active')
        
    if (step === 'first') {
      $target = this.$element.children('.wizard-step').first()
    } else if (step === 'prev') {
      $target = $active.prevAll('.wizard-step').first()
    } else if (step === 'next') {
      $target = $active.nextAll('.wizard-step').first()
    } else if (step === 'done' && this.options.donestep) {
      $target = this.$element.children('.wizard-step').last()
    } else if (typeof step === 'number' || step.match(/^-?\d+$/)) {
      $target = this.$element.children('.wizard-step').eq(step + (step >= 0))
    } else {
      $target = $(step)
    }
    
    return $target
  }

  Wizard.prototype.activate = function ($target) {
    this.clearActivate()
    this.setActivate($target)
    this.setProgress($target)
  }

  Wizard.prototype.clearActivate = function () {
    var self = this
    var $links = $()
    
    var id = this.$element.attr('id')
    $links = $links.add('[data-target="#' + id + '"], a[href="#' + id + '"]')
  
    var ids = this.$element.children('.wizard-step[id]').map(function() {
      return $(this).attr('id')
    })

    $.each(ids, function(id) {
      $links = $links.add('[data-target="#' + id + '"],a[href="#' + id + '"]')
    })
    
    $links.each(function() {
      $(this).closest('.wizard-hide').removeClass('in')
      self.getActivateElement(this).not('.progress').removeClass('active')
    })
  }
  
  Wizard.prototype.setActivate = function ($target) {
    var self = this
    var $steps = this.$element.children('.wizard-step')
    var $target = $steps.filter('.active')
    var index = $steps.index($target)
    var length = $steps.length - (this.options.donestep ? 1 : 0)
    
    if (index === -1) return // shouldn't happen
    
    var id = this.$element.attr('id')
    $('[data-target="#' + id + '"],a[href="#' + id + '"]').filter(function() {
      var step = $(this).data('step')

      if (!step) return false
      if ($target.is(step)) return true
      if (typeof step === 'number' || step.match(/^\d+$/)) {
        step = parseInt(step, 10)
        return step === index + 1 || step === index - $steps.length
      }

      if (step === 'first' || step === 'prev') return index > 0
      if (step === 'next') return index + 1 < length
      if (step === 'done') return index + 1 === length
    }).each(function() {
      $(this).closest('.wizard-hide').addClass('in')

      var $el = self.getActivateElement(this)
      $el.addClass('active')
    })
    
    $('[data-target="#' + $target.attr('id') + '"],a[href="#' + $target.attr('id') + '"]').each(function() {
      $(this).closest('.wizard-hide').addClass('in')
      self.getActivateElement(this).addClass('active')
    })
  }

  Wizard.prototype.getActivateElement = function (link) {
    if ($(link).closest('.wizard-follow').length === 0) return $()
    
    if ($(link).closest('li').length) {
      return $(link).parentsUntil('.wizard-follow', 'li')
    }

    return $(link)
  }

  Wizard.prototype.setProgress = function ($target) {
    var $steps = this.$element.children('.wizard-step')
    var $progress = $('.progress.wizard-follow[data-target="#' + this.$element.attr('id') + '"]')
    var index = $steps.index($target)
    var length = $steps.length - (this.options.donestep ? 1 : 0)

    $progress.find('.step').text(index + 1)
    $progress.find('.steps').text(length)
    
    $progress[index < length ? 'show' : 'hide']()
    $progress.find('.progress-bar').width(((index + 1) * 100 / length) + '%')
  }
  
  // WIZARD PLUGIN DEFINITION
  // ===========================

  var old = $.fn.wizard

  $.fn.wizard = function (option) {
    return this.each(function () {
      var $this = $(this)
      var data    = $this.data('bs.wizard')
      var options = $.extend({}, Wizard.DEFAULTS, $this.data(), typeof option === 'object' && option)

      if (!data) $this.data('bs.wizard', (data = new Wizard(this, options)))
      
      if (option === 'refresh') data.refresh()
       else if (typeof option === 'string' || typeof option === 'number') data.show(option)
    })
  }

  $.fn.wizard.Constructor = Wizard


  // WIZARD NO CONFLICT
  // ====================

  $.fn.wizard.noConflict = function () {
    $.fn.wizard = old
    return this
  }


  // WIZARD DATA-API
  // =================

  $(document).on('click.bs.wizard.data-api', '[data-toggle=wizard]', function (e) {
    var $this   = $(this), href
    var target  = $this.attr('data-target')
        || e.preventDefault()
        || (href = $this.attr('href')) && href.replace(/.*(?=#[^\s]+$)/, '') //strip for ie7
    var $element = $(target).closest('.wizard')
    
    var step = $(target).hasClass('wizard') ? $this.data('step') : target
    
    e.preventDefault()
    $element.wizard(step)
  })

}(window.jQuery);
